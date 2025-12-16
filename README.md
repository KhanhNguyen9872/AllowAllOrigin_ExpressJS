# Backend Express.js cho video-downloader

- **Mục đích**: Làm proxy server-side để gọi tới các URL video/audio (Facebook, v.v.) và trả dữ liệu về cho frontend mà không bị CORS.
- **Port mặc định**: `4000`.

## Cài đặt

```bash
cd server
npm install
```

## Chạy server

```bash
# production
npm start

# development (auto reload)
npm run dev
```

Server cung cấp endpoint:

- `GET /proxy?url=<encoded_source_url>`: proxy bất kỳ URL, thêm CORS header `Access-Control-Allow-Origin: *` để frontend có thể truy cập.


