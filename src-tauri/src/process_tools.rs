use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowProcessTarget {
    pid: u32,
    process_name: String,
    window_title: String,
    executable_path: String,
    window_handle: u64,
    window_class: String,
    close_window_only: bool,
}

#[tauri::command]
pub async fn pick_window_process(app: AppHandle) -> Result<Option<WindowProcessTarget>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || pick_window_process_blocking(&app))
            .await
            .map_err(|error| error.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("窗口进程选择仅支持 Windows".into())
    }
}

#[tauri::command]
pub fn terminate_window_process(target: WindowProcessTarget) -> Result<(), String> {
    #[cfg(windows)]
    {
        terminate_process_windows(&target)
    }
    #[cfg(not(windows))]
    {
        let _ = target;
        Err("进程结束功能仅支持 Windows".into())
    }
}

#[cfg(windows)]
fn pick_window_process_blocking(app: &AppHandle) -> Result<Option<WindowProcessTarget>, String> {
    use std::{
        thread,
        time::{Duration, Instant},
    };
    use windows_sys::Win32::{
        Foundation::POINT,
        UI::{
            Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE, VK_LBUTTON},
            WindowsAndMessaging::{
                GetAncestor, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
                WindowFromPoint, GA_ROOT,
            },
        },
    };

    crate::window::hide_main_window(app.clone())?;
    thread::sleep(Duration::from_millis(250));

    let result = (|| {
        while key_is_down(unsafe { GetAsyncKeyState(VK_LBUTTON as i32) }) {
            thread::sleep(Duration::from_millis(15));
        }
        unsafe { GetAsyncKeyState(VK_LBUTTON as i32) };
        let started = Instant::now();
        loop {
            if key_was_pressed(unsafe { GetAsyncKeyState(VK_ESCAPE as i32) }) {
                return Ok(None);
            }
            if key_was_pressed(unsafe { GetAsyncKeyState(VK_LBUTTON as i32) }) {
                let mut point = POINT { x: 0, y: 0 };
                if unsafe { windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut point) }
                    == 0
                {
                    return Err(last_windows_error("读取鼠标位置失败"));
                }
                let child = unsafe { WindowFromPoint(point) };
                if child.is_null() {
                    return Err("没有选中可关闭的窗口".into());
                }
                let window = unsafe { GetAncestor(child, GA_ROOT) };
                let mut window = if window.is_null() { child } else { window };
                let mut click_through_window = false;
                let mut direct_pid = 0u32;
                unsafe { GetWindowThreadProcessId(window, &mut direct_pid) };
                if direct_pid != 0 {
                    let direct_path = process_path(direct_pid)?;
                    let direct_name = process_name(&direct_path);
                    let direct_class = window_class(window);
                    if direct_name.eq_ignore_ascii_case("explorer.exe")
                        && !is_explorer_shell_frame(&direct_name, &direct_class)
                    {
                        if let Some(overlay) = closable_window_above_point(point, window) {
                            window = overlay;
                            click_through_window = true;
                        }
                    }
                }
                let mut pid = 0u32;
                unsafe { GetWindowThreadProcessId(window, &mut pid) };
                if pid == 0 {
                    return Err("没有找到该窗口所属的进程".into());
                }
                let executable_path = process_path(pid)?;
                let process_name = process_name(&executable_path);
                let window_class = window_class(window);
                let close_window_only = click_through_window
                    || is_explorer_shell_frame(&process_name, &window_class)
                    || prefers_window_only(&window_class);
                if !close_window_only {
                    guard_target(pid, &process_name)?;
                }
                let title_length = unsafe { GetWindowTextLengthW(window) }.max(0) as usize;
                let mut title = vec![0u16; title_length.saturating_add(1)];
                let copied = unsafe {
                    GetWindowTextW(window, title.as_mut_ptr(), title.len() as i32)
                }
                .max(0) as usize;
                title.truncate(copied);
                return Ok(Some(WindowProcessTarget {
                    pid,
                    process_name,
                    window_title: String::from_utf16_lossy(&title),
                    executable_path,
                    window_handle: window as usize as u64,
                    window_class,
                    close_window_only,
                }));
            }
            if started.elapsed() >= Duration::from_secs(30) {
                return Ok(None);
            }
            thread::sleep(Duration::from_millis(15));
        }
    })();

    let restore_result = crate::window::expand_main_window(app.clone());
    match (result, restore_result) {
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => Err(error),
        (Ok(target), Ok(())) => Ok(target),
    }
}

#[cfg(windows)]
fn key_is_down(state: i16) -> bool {
    state as u16 & 0x8000 != 0
}

#[cfg(windows)]
fn key_was_pressed(state: i16) -> bool {
    state as u16 & 0x8001 != 0
}

#[cfg(windows)]
fn terminate_process_windows(target: &WindowProcessTarget) -> Result<(), String> {
    use windows_sys::Win32::{
        Foundation::CloseHandle,
        System::Threading::{
            OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION,
            PROCESS_TERMINATE,
        },
    };

    if target.close_window_only {
        return close_window_windows(target);
    }
    guard_target(target.pid, &target.process_name)?;
    let current_path = process_path(target.pid)?;
    guard_target(target.pid, &process_name(&current_path))?;
    if !current_path.eq_ignore_ascii_case(&target.executable_path) {
        return Err("目标进程已经发生变化，请重新选择窗口".into());
    }
    let handle = unsafe {
        OpenProcess(
            PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION,
            0,
            target.pid,
        )
    };
    if handle.is_null() {
        return Err(last_windows_error("打开目标进程失败"));
    }
    let terminated = unsafe { TerminateProcess(handle, 1) };
    if terminated == 0 {
        let error = last_windows_error("结束目标进程失败");
        unsafe { CloseHandle(handle) };
        return Err(error);
    }
    unsafe {
        WaitForSingleObject(handle, 3_000);
        CloseHandle(handle);
    }
    Ok(())
}

#[cfg(windows)]
fn close_window_windows(target: &WindowProcessTarget) -> Result<(), String> {
    use std::{thread, time::Duration};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        IsWindow, IsWindowVisible, PostMessageW, ShowWindow, SW_HIDE, WM_CLOSE,
    };

    let window = target.window_handle as usize as *mut std::ffi::c_void;
    if window.is_null() || unsafe { IsWindow(window) } == 0 {
        return Err("目标白屏窗口已经关闭".into());
    }
    let mut pid = 0u32;
    unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(window, &mut pid)
    };
    let current_path = process_path(pid)?;
    let current_name = process_name(&current_path);
    let current_class = window_class(window);
    if pid != target.pid
        || !current_path.eq_ignore_ascii_case(&target.executable_path)
        || !current_class.eq_ignore_ascii_case(&target.window_class)
        || (is_protected_process_name(&current_name)
            && !is_explorer_shell_frame(&current_name, &current_class))
    {
        return Err("目标窗口已经发生变化，请重新选择".into());
    }

    if unsafe { PostMessageW(window, WM_CLOSE, 0, 0) } == 0 {
        return Err(last_windows_error("关闭白屏窗口失败"));
    }
    thread::sleep(Duration::from_millis(350));
    if unsafe { IsWindow(window) } != 0 && unsafe { IsWindowVisible(window) } != 0 {
        unsafe { ShowWindow(window, SW_HIDE) };
    }
    Ok(())
}

#[cfg(windows)]
fn process_path(pid: u32) -> Result<String, String> {
    use windows_sys::Win32::{
        Foundation::CloseHandle,
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
        },
    };

    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() {
        return Err(last_windows_error("读取目标进程信息失败"));
    }
    let mut path = vec![0u16; 32_768];
    let mut length = path.len() as u32;
    let queried = unsafe { QueryFullProcessImageNameW(handle, 0, path.as_mut_ptr(), &mut length) };
    unsafe { CloseHandle(handle) };
    if queried == 0 {
        return Err(last_windows_error("读取目标进程路径失败"));
    }
    path.truncate(length as usize);
    Ok(String::from_utf16_lossy(&path))
}

#[cfg(windows)]
fn window_class(window: windows_sys::Win32::Foundation::HWND) -> String {
    use windows_sys::Win32::UI::WindowsAndMessaging::GetClassNameW;

    let mut class = vec![0u16; 256];
    let copied =
        unsafe { GetClassNameW(window, class.as_mut_ptr(), class.len() as i32) }.max(0) as usize;
    class.truncate(copied);
    String::from_utf16_lossy(&class)
}

#[cfg(windows)]
fn closable_window_above_point(
    point: windows_sys::Win32::Foundation::POINT,
    stop_at: windows_sys::Win32::Foundation::HWND,
) -> Option<windows_sys::Win32::Foundation::HWND> {
    use windows_sys::Win32::{
        Foundation::RECT,
        UI::WindowsAndMessaging::{
            GetTopWindow, GetWindow, GetWindowRect, GetWindowThreadProcessId, IsWindowVisible,
            GW_HWNDNEXT,
        },
    };

    let mut candidate = unsafe { GetTopWindow(std::ptr::null_mut()) };
    for _ in 0..512 {
        if candidate.is_null() {
            break;
        }
        if candidate == stop_at {
            candidate = unsafe { GetWindow(candidate, GW_HWNDNEXT) };
            continue;
        }
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if unsafe { IsWindowVisible(candidate) } != 0
            && unsafe { GetWindowRect(candidate, &mut rect) } != 0
            && point_in_rect(
                point.x,
                point.y,
                rect.left,
                rect.top,
                rect.right,
                rect.bottom,
            )
        {
            let mut pid = 0u32;
            unsafe { GetWindowThreadProcessId(candidate, &mut pid) };
            if pid != 0 && pid != std::process::id() {
                if let Ok(path) = process_path(pid) {
                    let name = process_name(&path);
                    let class = window_class(candidate);
                    if !is_protected_process_name(&name) || is_explorer_shell_frame(&name, &class) {
                        return Some(candidate);
                    }
                }
            }
        }
        candidate = unsafe { GetWindow(candidate, GW_HWNDNEXT) };
    }
    None
}

fn point_in_rect(x: i32, y: i32, left: i32, top: i32, right: i32, bottom: i32) -> bool {
    x >= left && x < right && y >= top && y < bottom
}

#[cfg(windows)]
fn last_windows_error(context: &str) -> String {
    format!("{context}：{}", std::io::Error::last_os_error())
}

fn process_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path)
        .to_string()
}

fn guard_target(pid: u32, process_name: &str) -> Result<(), String> {
    if pid == std::process::id() {
        return Err("请选择 ClipNote 之外的窗口".into());
    }
    if is_protected_process_name(process_name) {
        return Err(format!("系统进程 {process_name} 不允许在此结束"));
    }
    Ok(())
}

fn is_protected_process_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "csrss.exe"
            | "dwm.exe"
            | "explorer.exe"
            | "fontdrvhost.exe"
            | "lsass.exe"
            | "services.exe"
            | "sihost.exe"
            | "smss.exe"
            | "system"
            | "taskhostw.exe"
            | "textinputhost.exe"
            | "ctfmon.exe"
            | "runtimebroker.exe"
            | "searchhost.exe"
            | "shellexperiencehost.exe"
            | "startmenuexperiencehost.exe"
            | "wininit.exe"
            | "winlogon.exe"
    )
}

fn is_explorer_shell_frame(process_name: &str, window_class: &str) -> bool {
    process_name.eq_ignore_ascii_case("explorer.exe")
        && window_class.eq_ignore_ascii_case("ApplicationFrameWindow")
}

fn prefers_window_only(window_class: &str) -> bool {
    window_class.eq_ignore_ascii_case("ApplicationFrameWindow")
        || window_class.eq_ignore_ascii_case("Chrome_WidgetWin_1")
        || window_class.eq_ignore_ascii_case("Tauri Window")
        || window_class.to_ascii_lowercase().starts_with("qt")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protects_windows_shell_and_security_processes() {
        assert!(is_protected_process_name("explorer.exe"));
        assert!(is_protected_process_name("LSASS.EXE"));
        assert!(!is_protected_process_name("notepad.exe"));
        assert!(is_explorer_shell_frame(
            "EXPLORER.EXE",
            "ApplicationFrameWindow"
        ));
        assert!(!is_explorer_shell_frame("explorer.exe", "Progman"));
        assert!(prefers_window_only("Chrome_WidgetWin_1"));
        assert!(prefers_window_only("Qt680QWindowIcon"));
        assert!(!prefers_window_only("Notepad"));
        assert!(is_protected_process_name("TextInputHost.exe"));
        assert!(point_in_rect(400, 300, 0, 0, 1920, 1080));
        assert!(!point_in_rect(1920, 300, 0, 0, 1920, 1080));
    }

    #[cfg(windows)]
    #[test]
    fn accepts_held_and_fast_click_states() {
        assert!(key_was_pressed(0x8000u16 as i16));
        assert!(key_was_pressed(1));
        assert!(!key_was_pressed(0));
        assert!(key_is_down(0x8000u16 as i16));
        assert!(!key_is_down(1));
    }

    #[cfg(windows)]
    #[test]
    fn terminates_an_independent_fixture_process() {
        use std::process::{Command, Stdio};

        let executable = std::path::Path::new(&std::env::var("SystemRoot").unwrap())
            .join("System32")
            .join("ping.exe");
        let mut child = Command::new(executable)
            .args(["-t", "127.0.0.1"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let executable_path = process_path(child.id()).unwrap();
        let target = WindowProcessTarget {
            pid: child.id(),
            process_name: process_name(&executable_path),
            window_title: "fixture".into(),
            executable_path,
            window_handle: 0,
            window_class: "fixture".into(),
            close_window_only: false,
        };

        terminate_process_windows(&target).unwrap();

        assert!(child.wait().unwrap().code().is_some());
    }
}
