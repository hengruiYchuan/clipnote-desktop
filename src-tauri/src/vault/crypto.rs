use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, Payload},
    KeyInit, XChaCha20Poly1305, XNonce,
};
use zeroize::Zeroizing;

pub const KEY_BYTES: usize = 32;
pub const SALT_BYTES: usize = 16;
pub const NONCE_BYTES: usize = 24;
pub const DEFAULT_MEMORY_KIB: u32 = 65_536;
pub const DEFAULT_ITERATIONS: u32 = 3;
pub const DEFAULT_PARALLELISM: u32 = 1;
const KEY_AAD: &[u8] = b"clipnote-vault-key-v1";

pub struct WrappedVaultKey {
    pub salt: [u8; SALT_BYTES],
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub nonce: [u8; NONCE_BYTES],
    pub ciphertext: Vec<u8>,
}

pub fn create_vault_key(
    password: &str,
) -> Result<(Zeroizing<[u8; KEY_BYTES]>, WrappedVaultKey), String> {
    let vault_key = Zeroizing::new(random_array()?);
    let wrapped = wrap_vault_key(password, &vault_key)?;
    Ok((vault_key, wrapped))
}

pub fn wrap_vault_key(
    password: &str,
    vault_key: &[u8; KEY_BYTES],
) -> Result<WrappedVaultKey, String> {
    let salt = random_array()?;
    let nonce = random_array()?;
    let wrapping_key = derive_key(
        password,
        &salt,
        DEFAULT_MEMORY_KIB,
        DEFAULT_ITERATIONS,
        DEFAULT_PARALLELISM,
    )?;
    let ciphertext = encrypt(&wrapping_key, &nonce, vault_key, KEY_AAD)?;
    Ok(WrappedVaultKey {
        salt,
        memory_kib: DEFAULT_MEMORY_KIB,
        iterations: DEFAULT_ITERATIONS,
        parallelism: DEFAULT_PARALLELISM,
        nonce,
        ciphertext,
    })
}

pub fn unwrap_vault_key(
    password: &str,
    wrapped: &WrappedVaultKey,
) -> Result<Zeroizing<[u8; KEY_BYTES]>, String> {
    let wrapping_key = derive_key(
        password,
        &wrapped.salt,
        wrapped.memory_kib,
        wrapped.iterations,
        wrapped.parallelism,
    )?;
    let plaintext = decrypt(&wrapping_key, &wrapped.nonce, &wrapped.ciphertext, KEY_AAD)
        .map_err(|_| "主密码错误".to_string())?;
    let key: [u8; KEY_BYTES] = plaintext
        .try_into()
        .map_err(|_| "密码本密钥已损坏".to_string())?;
    Ok(Zeroizing::new(key))
}

pub fn encrypt_entry(
    key: &[u8; KEY_BYTES],
    id: &str,
    plaintext: &[u8],
) -> Result<([u8; NONCE_BYTES], Vec<u8>), String> {
    let nonce = random_array()?;
    let aad = format!("clipnote-vault-entry-v1:{id}");
    let ciphertext = encrypt(key, &nonce, plaintext, aad.as_bytes())?;
    Ok((nonce, ciphertext))
}

pub fn decrypt_entry(
    key: &[u8; KEY_BYTES],
    id: &str,
    nonce: &[u8; NONCE_BYTES],
    ciphertext: &[u8],
) -> Result<Zeroizing<Vec<u8>>, String> {
    let aad = format!("clipnote-vault-entry-v1:{id}");
    decrypt(key, nonce, ciphertext, aad.as_bytes())
        .map(Zeroizing::new)
        .map_err(|_| "密码条目已损坏".to_string())
}

pub fn random_id() -> Result<String, String> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};

    let bytes: [u8; 16] = random_array()?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn derive_key(
    password: &str,
    salt: &[u8; SALT_BYTES],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<Zeroizing<[u8; KEY_BYTES]>, String> {
    let params = Params::new(memory_kib, iterations, parallelism, Some(KEY_BYTES))
        .map_err(|_| "密码本密钥参数无效".to_string())?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut output = Zeroizing::new([0u8; KEY_BYTES]);
    argon2
        .hash_password_into(password.as_bytes(), salt, output.as_mut())
        .map_err(|_| "主密码派生失败".to_string())?;
    Ok(output)
}

fn encrypt(
    key: &[u8; KEY_BYTES],
    nonce: &[u8; NONCE_BYTES],
    plaintext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, String> {
    let cipher =
        XChaCha20Poly1305::new_from_slice(key).map_err(|_| "密码本密钥无效".to_string())?;
    cipher
        .encrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: plaintext,
                aad,
            },
        )
        .map_err(|_| "密码条目加密失败".to_string())
}

fn decrypt(
    key: &[u8; KEY_BYTES],
    nonce: &[u8; NONCE_BYTES],
    ciphertext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, String> {
    let cipher =
        XChaCha20Poly1305::new_from_slice(key).map_err(|_| "密码本密钥无效".to_string())?;
    cipher
        .decrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: ciphertext,
                aad,
            },
        )
        .map_err(|_| "解密失败".to_string())
}

fn random_array<const N: usize>() -> Result<[u8; N], String> {
    let mut bytes = [0u8; N];
    getrandom::fill(&mut bytes).map_err(|_| "系统随机数不可用".to_string())?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrapped_key_requires_the_correct_password() {
        let (key, wrapped) = create_vault_key("a long master password").unwrap();
        let unwrapped = unwrap_vault_key("a long master password", &wrapped).unwrap();
        assert_eq!(key.as_ref(), unwrapped.as_ref());
        assert_eq!(
            unwrap_vault_key("the wrong password", &wrapped).unwrap_err(),
            "主密码错误"
        );
    }

    #[test]
    fn entry_aad_detects_id_changes_and_tampering() {
        let key = [7u8; KEY_BYTES];
        let (nonce, mut ciphertext) = encrypt_entry(&key, "entry-a", b"secret").unwrap();
        assert_eq!(
            decrypt_entry(&key, "entry-a", &nonce, &ciphertext)
                .unwrap()
                .as_slice(),
            b"secret"
        );
        assert!(decrypt_entry(&key, "entry-b", &nonce, &ciphertext).is_err());
        ciphertext[0] ^= 1;
        assert!(decrypt_entry(&key, "entry-a", &nonce, &ciphertext).is_err());
    }
}
