# 📱 YouTube Mobile App Simulator Extension

Extension trình duyệt hỗ trợ **YouTube Web trên Điện Thoại (`m.youtube.com`)** mang lại trải nghiệm như sử dụng ứng dụng YouTube Native Mobile trực tiếp trên web browser.

---

## ✨ Tính Năng Nổi Bật

---

## 🛠️ Hướng Dẫn Cài Đặt (Installation Guide)

### 📲 1. Cài đặt trên Điện Thoại (Android & iOS)

> **Lưu ý**: Cần trình duyệt điện thoại có hỗ trợ Chrome/Firefox Extension (ví dụ: **Kiwi Browser**, **Firefox Nightly**, hoặc **Orion Browser** trên iOS).

---

## 📂 Cấu Trúc Mã Nguồn

- `manifest.json`: File cấu hình Extension Manifest V3.
- `scripts/content.js`: Xử lý theo dõi điều hướng SPA YouTube, reparent video vào miniplayer và cử chỉ kéo thả.
- `scripts/injected.js`: Ghi đè Visibility API để phát âm thanh ở nền (Anti-Pause Engine).
- `styles/miniplayer.css`: Style CSS cho khung nổi Floating Mini-player, hiệu ứng kính mờ glassmorphism và cử chỉ.
- `popup/`: Giao diện cài đặt và tùy chọn tiện ích.
