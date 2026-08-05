# 📱 YouTube Mobile App Simulator Extension

Extension trình duyệt hỗ trợ **YouTube Web trên Điện Thoại (`m.youtube.com`)** mang lại trải nghiệm như sử dụng ứng dụng YouTube Native Mobile trực tiếp trên web browser.

---

## ✨ Tính Năng Nổi Bật

1. **Floating Mini-Player (Trình phát thu nhỏ di động)**:
   - Khi bạn đang phát video và bấm về **Trang chủ**, **Kênh đăng ký**, **Tìm kiếm** hoặc **Thư viện**, video sẽ không bị ngắt mà tự động thu nhỏ thành khung Floating Mini-Player ở góc màn hình.
   - Hỗ trợ **kéo thả di chuyển (Drag & Drop)** đến bất kỳ đâu trên màn hình.
   - Nút tạm dừng/phát nhanh, phóng to lại full video hoặc vuốt xuống để đóng.

2. **Phát Nhạc Nền / Xem khi chuyển tab (Background Audio Playback)**:
   - Chặn tự động tạm dừng khi ẩn trình duyệt, chuyển sang ứng dụng khác hoặc tắt màn hình điện thoại.
   - Tương thích tốt với thanh điều khiển phương tiện (Media Notification) của hệ điều hành.

3. **Cử Chỉ Touch & Vuốt Mượt Mà**:
   - Chạm vào mini-player để hiện thanh điều khiển.
   - Vuốt nhẹ mini-player xuống dưới để thu gọn/đóng.

4. **Extension Popup UI Cao Cấp**:
   - Giao diện Dark Mode Glassmorphism hiện đại.
   - Tùy chỉnh bật/tắt nhanh các tính năng theo nhu cầu.

---

## 🛠️ Hướng Dẫn Cài Đặt (Installation Guide)

### 📲 1. Cài đặt trên Điện Thoại (Android & iOS)

> **Lưu ý**: Cần trình duyệt điện thoại có hỗ trợ Chrome/Firefox Extension (ví dụ: **Kiwi Browser**, **Firefox Nightly**, hoặc **Orion Browser** trên iOS).

1. Tải và mở trình duyệt **Kiwi Browser** (trên Google Play Store).
2. Nhập `chrome://extensions` vào thanh địa chỉ.
3. Bật chế độ **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
4. Chọn **Load unpacked** (Tải tiện ích đã giải nén).
5. Chọn thư mục dự án `YTPj` (thư mục chứa file `manifest.json`).
6. Truy cập vào `https://m.youtube.com` để trải nghiệm!

---

### 💻 2. Cài đặt & Kiểm thử trên Máy Tính (Chrome / Edge / Brave)

Bạn cũng có thể trải nghiệm giao diện YouTube Mobile Web trên máy tính:

1. Mở Chrome/Edge, truy cập `chrome://extensions`.
2. Bật công tắc **Developer mode** (góc trên bên phải).
3. Bấm **Load unpacked** và chọn thư mục `YTPj`.
4. Mở tab mới và truy cập `https://m.youtube.com`.
5. Nhấn phím `F12` (hoặc `Ctrl + Shift + I`), bấm tổ hợp `Ctrl + Shift + M` để mở chế độ **Mobile Device Toolbar (Giả lập điện thoại)**.
6. Mở một video bất kỳ và nhấn chọn về Trang chủ/Kênh đăng ký để thấy Floating Mini-Player xuất hiện ở góc dưới!

---

## 📂 Cấu Trúc Mã Nguồn

- `manifest.json`: File cấu hình Extension Manifest V3.
- `scripts/content.js`: Xử lý theo dõi điều hướng SPA YouTube, reparent video vào miniplayer và cử chỉ kéo thả.
- `scripts/injected.js`: Ghi đè Visibility API để phát âm thanh ở nền (Anti-Pause Engine).
- `styles/miniplayer.css`: Style CSS cho khung nổi Floating Mini-player, hiệu ứng kính mờ glassmorphism và cử chỉ.
- `popup/`: Giao diện cài đặt và tùy chọn tiện ích.
