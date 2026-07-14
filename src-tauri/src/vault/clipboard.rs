use arboard::Clipboard;
use std::{thread, time::Duration};
use tauri::AppHandle;
use zeroize::{Zeroize, Zeroizing};

pub fn copy_secret(app: AppHandle, secret: String, clear_after: Duration) -> Result<(), String> {
    let mut secret = Zeroizing::new(secret);
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.set_text(secret.as_str().to_owned()))
        .map_err(|error| error.to_string())?;
    if let Err(error) = mark_clipboard_private() {
        let _ = Clipboard::new().and_then(|mut clipboard| clipboard.set_text(String::new()));
        crate::data::suppress_current_clipboard(&app);
        secret.zeroize();
        return Err(error);
    }
    crate::data::suppress_current_clipboard(&app);
    let expected_sequence = clipboard_sequence_number();

    thread::Builder::new()
        .name("clipnote-secret-clear".into())
        .spawn(move || {
            thread::sleep(clear_after);
            if clipboard_sequence_number() != expected_sequence {
                return;
            }
            let should_clear = Clipboard::new()
                .and_then(|mut clipboard| clipboard.get_text())
                .map(|content| content == secret.as_str())
                .unwrap_or(false);
            if should_clear {
                let _ =
                    Clipboard::new().and_then(|mut clipboard| clipboard.set_text(String::new()));
                let _ = mark_clipboard_private();
                crate::data::suppress_current_clipboard(&app);
            }
        })
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(windows)]
fn clipboard_sequence_number() -> Option<u32> {
    use windows_sys::Win32::System::DataExchange::GetClipboardSequenceNumber;

    Some(unsafe { GetClipboardSequenceNumber() })
}

#[cfg(not(windows))]
fn clipboard_sequence_number() -> Option<u32> {
    None
}

#[cfg(windows)]
fn mark_clipboard_private() -> Result<(), String> {
    use std::{ptr, thread};
    use windows_sys::Win32::Foundation::GlobalFree;
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
    };

    for attempt in 0..8 {
        if unsafe { OpenClipboard(ptr::null_mut()) } != 0 {
            let result = (|| {
                for (name, value) in [
                    ("ExcludeClipboardContentFromMonitorProcessing", 1u32),
                    ("CanIncludeInClipboardHistory", 0u32),
                    ("CanUploadToCloudClipboard", 0u32),
                ] {
                    let wide = name.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
                    let format = unsafe { RegisterClipboardFormatW(wide.as_ptr()) };
                    if format == 0 {
                        return Err("安全剪贴板格式注册失败".to_string());
                    }
                    let memory = unsafe { GlobalAlloc(GMEM_MOVEABLE, size_of::<u32>()) };
                    if memory.is_null() {
                        return Err("安全剪贴板内存分配失败".to_string());
                    }
                    let pointer = unsafe { GlobalLock(memory) } as *mut u32;
                    if pointer.is_null() {
                        unsafe { GlobalFree(memory) };
                        return Err("安全剪贴板内存锁定失败".to_string());
                    }
                    unsafe {
                        pointer.write(value);
                        GlobalUnlock(memory);
                    }
                    if unsafe { SetClipboardData(format, memory) }.is_null() {
                        unsafe { GlobalFree(memory) };
                        return Err("安全剪贴板标记失败".to_string());
                    }
                }
                Ok(())
            })();
            unsafe { CloseClipboard() };
            return result;
        }
        thread::sleep(Duration::from_millis(8 * (attempt + 1)));
    }
    Err("系统剪贴板正忙，请重试".into())
}

#[cfg(not(windows))]
fn mark_clipboard_private() -> Result<(), String> {
    Ok(())
}
