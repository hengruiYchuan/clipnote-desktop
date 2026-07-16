chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "clipnote-fill") return;
  const filled = fillLoginForm(message.credential || {});
  sendResponse({ filled });
});

function fillLoginForm({ username = "", password = "" }) {
  const passwordInputs = visibleInputs('input[type="password"]');
  const passwordInput = passwordInputs[0];
  if (!passwordInput) return false;
  const scope = passwordInput.form || document;
  const usernameInput = visibleInputs(
    'input[autocomplete="username"], input[type="email"], input[name*="user" i], input[name*="email" i], input[type="text"]',
    scope,
  ).find((input) => input !== passwordInput);
  if (username && usernameInput) setInputValue(usernameInput, username);
  setInputValue(passwordInput, password);
  passwordInput.focus();
  return true;
}

function visibleInputs(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector)).filter((input) => {
    const rect = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    return !input.disabled && !input.readOnly && rect.width > 0 && rect.height > 0
      && style.visibility !== "hidden" && style.display !== "none";
  });
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
