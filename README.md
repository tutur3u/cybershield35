# CyberShield 35

Hệ thống theo dõi thông tin và soạn bài phản hồi có dẫn chứng, dành cho đội ngũ
vận hành của Công an phường Ea Kao.

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16.3-000?logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19.2-149eca?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript&logoColor=white">
  <img alt="Postgres" src="https://img.shields.io/badge/Postgres-Drizzle-4169e1?logo=postgresql&logoColor=white">
  <img alt="Bun" src="https://img.shields.io/badge/Bun-runtime-fbf0df?logo=bun&logoColor=black">
</p>

> Tài liệu tiếng Việt là bản chính. English version is further down.

**Đơn vị chủ quản:** [Công an phường Ea Kao](https://zalo.me/2629920369363080604) ·
**Phát triển & cung cấp công nghệ:** [Tuturuuu](https://tuturuuu.com)

> **Sản phẩm dự thi.** CyberShield 35 là một phần bài dự thi gửi tới
> [AI For Life — ai.daklak.gov.vn](https://ai.daklak.gov.vn).

---

# Bản tiếng Việt

### Mục lục

| Phần | Trả lời câu hỏi |
| --- | --- |
| [CS35 làm gì](#cybershield-35-làm-gì) | Sản phẩm này giải quyết việc gì |
| [Kiến trúc tổng thể](#kiến-trúc-tổng-thể) | Các thành phần và dòng dữ liệu |
| [Quy trình 5 bước](#quy-trình-5-bước) | Một ngày làm việc diễn ra thế nào |
| [Một lượt quét chạy thế nào](#một-lượt-quét-chạy-thế-nào) | Trạng thái, giới hạn 3 lượt, khi nào thử lại |
| [Chi phí AI đi qua đâu](#chi-phí-ai-đi-qua-đâu) | Vì sao mức dùng AI có thể thiếu |
| [Tóm tắt xu hướng được lưu lại](#tóm-tắt-xu-hướng-được-lưu-lại) | Vì sao trang mở gần như tức thì |
| [Dữ liệu được lưu thế nào](#dữ-liệu-được-lưu-thế-nào) | Các bảng chính và quan hệ |
| [Mức rủi ro được xác định thế nào](#mức-rủi-ro-được-xác-định-thế-nào) | Ai chấm điểm và dựa vào đâu |
| [Cài đặt máy chủ](#cài-đặt-máy-chủ) | Chạy dự án lên |
| [Xác thực](#xác-thực) | Đăng nhập và biến môi trường |
| [Tài khoản tên đăng nhập + mật khẩu](#tài-khoản-tên-đăng-nhập--mật-khẩu) | Cấp tài khoản cho người không có Tuturuuu |
| [Tích hợp bên ngoài](#tích-hợp-bên-ngoài) | Apify, Zalo OA, lịch chạy |
| [Vận hành](#vận-hành) | Khi có sự cố thì xem ở đâu |

## CyberShield 35 làm gì

CS35 theo dõi các nguồn công khai trên mạng xã hội, chấm mức rủi ro cho từng nội
dung thu thập được, rồi giúp biên tập viên soạn bài phản hồi và đăng lên Zalo
Official Account.

Điểm cốt lõi: **máy đề xuất, người quyết định**. Không nội dung nào tự động đến
tay công chúng. Bản nháp có thể được đưa lên Zalo ở dạng ẩn để rà soát, nhưng chỉ
hiển thị công khai sau khi có người phê duyệt và bấm đăng.

## Kiến trúc tổng thể

```mermaid
flowchart LR
    subgraph src["Nguồn công khai"]
        FB["Fanpage, nhóm<br/>Facebook"]
        WEB["Website, đường dẫn"]
    end

    subgraph collect["Thu thập"]
        APIFY["Apify"]
        FIRE["Firecrawl"]
        BU["Browser Use"]
    end

    subgraph core["CyberShield 35"]
        QUEUE["Hàng đợi quét<br/>scan_jobs · tối đa 3 lượt song song"]
        WF["Vercel Workflows<br/>tiến trình bền, tự thử lại"]
        DB[("Postgres · Neon")]
        LLM["Chấm rủi ro, phân tích<br/>qua Tuturuuu AI"]
        EDITOR["Soạn bài<br/>có dẫn chứng"]
    end

    subgraph out["Đầu ra"]
        ZALO["Zalo OA"]
        FILES["Word, PDF,<br/>bản đọc"]
    end

    FB --> APIFY
    WEB --> FIRE
    WEB --> BU
    QUEUE --> WF
    WF --> APIFY
    WF --> FIRE
    WF --> BU
    APIFY --> DB
    FIRE --> DB
    BU --> DB
    DB --> LLM
    LLM --> DB
    DB --> EDITOR
    EDITOR -->|"người phê duyệt"| ZALO
    EDITOR --> FILES
```

Vercel Cron kích hoạt hai công việc định kỳ: **quét nguồn hằng ngày** (00:00 UTC)
và **đẩy hàng đợi xuất bản Zalo** mỗi 5 phút.

Một lượt quét chạy như *tiến trình bền* trên Vercel Workflows chứ không nằm trong
vòng đời một request: nó chờ crawler bên ngoài và hai lần gọi mô hình, nhiều hơn
ngân sách một request nên có, và tiến trình bền vẫn sống sót khi có bản triển
khai mới rơi vào giữa lượt quét.

## Quy trình 5 bước

```mermaid
flowchart LR
    S1["1 · Nguồn & Quét"] --> S2["2 · Dòng thời gian"]
    S2 --> S3["3 · Phân tích"]
    S3 --> S4["4 · Bài viết"]
    S4 --> S5["5 · Xuất bản"]
    S5 -.->|"nguồn mới phát hiện"| S1
```

1. **Nguồn & Quét** — khai báo fanpage, nhóm hoặc đường dẫn cần theo dõi. Hệ
   thống xếp hàng và chạy quét, hiển thị rõ đang chờ, đang quét hay đã xong.
2. **Dòng thời gian** — mọi nội dung thu thập được, sắp theo thời gian, kèm mức
   rủi ro và lý do vì sao được xếp mức đó.
3. **Phân tích** — bức tranh tổng thể: cơ cấu rủi ro, nguyên nhân, chủ đề nổi bật
   và nguồn đang tạo ra chúng.
4. **Bài viết** — soạn bản phản hồi từ dẫn chứng, có trợ lý AI hỗ trợ; mọi đề
   xuất của AI đều phải được xem lại trước khi áp dụng.
5. **Xuất bản** — đưa bản ẩn lên Zalo OA để kiểm tra, phê duyệt, rồi hiển thị
   công khai. Có thể tải bài về dạng Word, PDF hoặc bản đọc tiếng Việt.

## Một lượt quét chạy thế nào

```mermaid
stateDiagram-v2
    [*] --> queued: thêm nguồn hoặc tới lịch
    queued --> running: còn chỗ trong 3 slot
    queued --> queued: hết chỗ, chờ lượt sau

    running --> completed: thu thập, chấm điểm,<br/>phân tích, gắn chủ đề xong
    running --> retrying: lỗi tạm thời
    running --> failed: lỗi dứt điểm

    retrying --> running: tự thử lại
    retrying --> failed: hết lượt thử

    failed --> queued: người dùng bấm Thử lại
    running --> retrying: treo quá 30 phút,<br/>hàng đợi thu hồi

    completed --> [*]
```

Sáu chặng trong một lượt: **Xếp hàng → Thu thập nội dung → Lưu bằng chứng →
Phân tích → Gắn chủ đề → Hoàn tất**. Mỗi chặng ghi lại tiến độ nên khi một lượt
quét dừng giữa chừng, màn hình chỉ đúng chỗ nó dừng.

**Tối đa 3 lượt song song.** Apify tính bộ nhớ gộp cho mọi lượt chạy trên cùng
một tài khoản: chạy 5 lượt cùng lúc là chạm trần và lượt thứ sáu bị từ chối
thẳng. Giới hạn này áp dụng cho cả lịch tự động lẫn nút **Quét ngay** — bấm khi
đã đủ 3 lượt thì scan được xếp hàng chứ không báo lỗi.

**Lỗi nào đáng thử lại.** Hết bộ nhớ hoặc bị giới hạn tần suất là tạm thời, tự
hết khi một lượt khác xong, nên hệ thống tự thử lại. Hết hạn mức chi tiêu, sai
khóa truy cập hay nguồn không còn công khai thì không: thử lại chỉ đốt hàng đợi
trong khi việc cần làm là nạp thêm hạn mức hoặc sửa cấu hình. Với những lượt đã
dừng hẳn, nút **Thử lại** đưa scan trở lại hàng đợi và đặt lại số lần thử — vẫn
tôn trọng giới hạn 3 lượt.

## Chi phí AI đi qua đâu

```mermaid
flowchart TD
    subgraph interactive["Có người dùng"]
        CHAT["Chat trong CS35"]
    end
    subgraph batch["Không có người dùng"]
        SCAN["Chấm rủi ro khi quét"]
        DRAFT["Soạn bản nháp, bài viết"]
        SUM["Tóm tắt xu hướng"]
    end

    CHAT -->|"phiên ứng dụng của<br/>chính người đang dùng"| GW["Tuturuuu AI Gateway<br/>ai.tuturuuu.com"]
    SCAN --> MACHINE{"Đã cấu hình<br/>máy định danh?"}
    DRAFT --> MACHINE
    SUM --> MACHINE
    MACHINE -->|"Có"| GW
    MACHINE -->|"Chưa"| DIRECT["Gọi thẳng nhà cung cấp<br/>không tính vào workspace"]

    GW --> METER["Tính vào mức dùng<br/>và chi phí của workspace"]
```

Chat mượn phiên của chính người đang dùng nên luôn đi qua cổng và luôn được tính.
Việc chạy nền thì không có phiên nào để mượn — nó cần **máy định danh**, khai báo
bằng `TUTURUUU_AI_APP_TOKEN` và `TUTURUUU_AI_WORKSPACE_ID`.

> **Chưa đặt hai biến này thì phần nặng nhất không được tính.** Chấm rủi ro cho
> hàng nghìn bài, mọi bản nháp và mọi bản tóm tắt sẽ chạy bằng khóa nhà cung cấp
> trực tiếp và không xuất hiện ở **Mức dùng AI**. Hệ thống vẫn chạy bình thường —
> đây là dự phòng có chủ ý để việc quét không dừng trong lúc chờ cấp định danh —
> nhưng số liệu chi phí sẽ thiếu đúng phần lớn nhất.

## Tóm tắt xu hướng được lưu lại

```mermaid
flowchart TD
    OPEN["Mở trang Phân tích"] --> READ[("Đọc bản đã lưu<br/>intelligence_summaries")]
    READ --> HAS{"Đã có bản nào chưa?"}
    HAS -->|"Chưa"| GEN["Sinh lần đầu<br/>rồi lưu lại"]
    HAS -->|"Rồi · khoảng 100ms"| SERVE["Trả về cho người xem"]
    GEN --> SERVE

    CRON["Lịch chạy hằng ngày"] --> FP{"Dấu vân dữ liệu<br/>còn khớp?"}
    FP -->|"Khớp"| SKIP["Bỏ qua, không gọi mô hình"]
    FP -->|"Khác"| REGEN["Sinh lại và lưu đè"]
    REGEN --> READ
```

Bản tóm tắt được **lưu vào cơ sở dữ liệu**, không nằm trong bộ nhớ đệm. Mỗi bản
mang một *dấu vân dữ liệu* — số bài và mốc thời gian mới nhất trong kỳ. Dấu vân
còn khớp nghĩa là chưa thu thập thêm gì, nên bản cũ vẫn là câu trả lời đúng và
không lời gọi mô hình nào cải thiện được nó. Một lượt quét hoàn tất sẽ làm dấu
vân đổi, và đó là điều duy nhất khiến hệ thống sinh lại.

Nhờ vậy trang mở gần như tức thì, và mô hình chỉ chạy khi dữ liệu thực sự đổi.

## Dữ liệu được lưu thế nào

```mermaid
erDiagram
    tracked_sources ||--o{ scan_jobs : "sinh ra"
    sources ||--o{ scan_jobs : "mô tả"
    scan_jobs ||--o{ evidence_items : "thu về"
    scan_jobs ||--o| analyses : "kết luận"
    evidence_items ||--o{ evidence_topics : "gắn"
    topics ||--o{ evidence_topics : "gom"
    evidence_items ||--o| evidence_triage : "xử lý"
    evidence_items ||--o{ articles : "làm căn cứ"
    articles ||--o{ article_publication_jobs : "đưa lên Zalo"
    facebook_page_profiles ||--o{ evidence_items : "phân loại nguồn"
```

`tracked_sources` là danh sách nguồn đội ngũ theo dõi và là nơi đặt **tên gọi**
cho một trang — mọi màn hình đều đọc tên từ đây, kèm `@handle` bên dưới.
`evidence_items` giữ nội dung đã chuẩn hóa cùng mức rủi ro, sắc thái và lập
trường. `articles` là bài phản hồi do người soạn, và chỉ đi lên Zalo qua
`article_publication_jobs` sau khi có người phê duyệt.

## Mức rủi ro được xác định thế nào

```mermaid
flowchart TD
    ITEM["Nội dung thu thập"] --> RULES["Bộ quy tắc nội bộ<br/>chạy ngay lúc thu thập"]
    RULES --> STORE[("Lưu vào cơ sở dữ liệu")]
    STORE --> HAS{"Đã cấu hình<br/>mô hình ngôn ngữ?"}
    HAS -->|"Có"| MODEL["Mô hình chấm lại<br/>và ghi đè"]
    HAS -->|"Không"| KEEP["Giữ kết quả<br/>của bộ quy tắc"]
    MODEL --> WHY["Hiển thị kèm giải thích:<br/>dấu hiệu, lĩnh vực,<br/>nguồn quyết định, độ tin cậy"]
    KEEP --> WHY
```

Mô hình ngôn ngữ là bộ phân loại chính. Bộ quy tắc nội bộ chỉ đóng vai trò dự
phòng: nó chạy ngay lúc thu thập (trước khi có dữ liệu trong cơ sở dữ liệu) và
khi không cấu hình được mô hình.

Ở mọi nơi hiển thị mức rủi ro đều kèm phần giải thích: nhóm dấu hiệu nào đã khớp,
nội dung liên quan tới lĩnh vực gì, do mô hình hay bộ quy tắc quyết định, và độ
tin cậy là bao nhiêu. Đây là **mức ưu tiên rà soát**, không phải kết luận đúng
hay sai.

## Cài đặt máy chủ

Chạy Postgres và các dịch vụ bằng Docker:

```bash
cp .env.example .env
docker compose up --build
```

Phát triển cục bộ:

```bash
bun install
bun run db:migrate
bun run dev
```

Các lệnh thường dùng:

| Lệnh | Công dụng |
| --- | --- |
| `bun run build` | Build production, bao gồm kiểm tra kiểu |
| `bun test` | Chạy toàn bộ test |
| `bun run typecheck` | Kiểm tra kiểu phần ứng dụng |
| `bun run typecheck:test` | Kiểm tra kiểu phần test |
| `bun run lint` | Chạy ESLint |
| `bun run worker` | Chạy worker xử lý hàng đợi |
| `bun run db:generate` | Sinh migration từ thay đổi schema |
| `bun run db:migrate` | Áp dụng migration |
| `bun run db:reclassify-risk` | Chấm lại mức rủi ro cho dữ liệu đã có |
| `bun run db:regenerate-headlines` | Soạn lại tiêu đề và trích yếu |

## Xác thực

CS35 chấp nhận hai loại thông tin đăng nhập. Cả hai đều tạo phiên lưu trong
cookie HttpOnly đã mã hóa, và **không bao giờ** yêu cầu người vận hành nhập khóa
ứng dụng, khóa nhà cung cấp hay bí mật LLM trên trình duyệt.

```mermaid
flowchart TD
    USER["Người vận hành"] --> CHOICE{"Chọn cách<br/>đăng nhập"}

    CHOICE -->|"Tuturuuu"| TTR["Đăng nhập tập trung<br/>tại tuturuuu.com"]
    TTR --> VERIFY["/verify-token đổi mã<br/>bàn giao ở phía máy chủ"]
    VERIFY --> SESS_T["Cookie<br/>cybershield35_admin_session"]

    CHOICE -->|"Mật khẩu"| PWD["Tên đăng nhập + mật khẩu"]
    PWD --> LOGIN["/api/auth/local/login<br/>đối chiếu hash scrypt"]
    LOGIN --> SESS_L["Cookie<br/>cybershield35_local_session"]

    SESS_T --> APP["Bảng điều khiển CS35"]
    SESS_L --> APP

    APP --> PLATFORM{"Chức năng cần<br/>token Tuturuuu?"}
    PLATFORM -->|"Có"| ONLY_T["Chỉ phiên Tuturuuu:<br/>tệp đính kèm Chat, hồ sơ,<br/>quản lý thành viên, bản đọc"]
    PLATFORM -->|"Không"| BOTH["Cả hai loại phiên"]
```

Quyền quản trị luôn bắt nguồn từ Tuturuuu: chỉ phiên Tuturuuu có quyền quản lý
thành viên mới cấp hoặc thu hồi được tài khoản mật khẩu.

### Tài khoản Tuturuuu

Khi đã cấu hình xác thực nhưng chưa có phiên, ứng dụng hiển thị nút
`Đăng nhập bằng Tuturuuu`. Nút này đưa người dùng tới trang đăng nhập tập trung
của Tuturuuu rồi quay lại `/verify-token`, nơi CS35 đổi mã bàn giao ngắn hạn ở
phía máy chủ qua `/api/auth/verify-app-token`.

### Biến môi trường bắt buộc

- `TUTURUUU_API_BASE_URL` — phải kết thúc bằng `/api/v1`
- `TUTURUUU_CYBERSHIELD35_WORKSPACE_ID`
- `CYBERSHIELD35_APP_ID`
- `CYBERSHIELD35_APP_SECRET`
- `DATABASE_URL`

### Biến môi trường tùy chọn

- `CYBERSHIELD35_SESSION_SECRET` — chỉ dùng khi muốn khóa mã hóa cookie xoay vòng
  độc lập với `CYBERSHIELD35_APP_SECRET`. Nếu bỏ trống, hệ thống dùng
  `CYBERSHIELD35_APP_SECRET`. Khóa này mã hóa **cả hai** loại cookie phiên, nên
  xoay khóa sẽ đăng xuất mọi người.
- `TUTURUUU_WEB_APP_URL` — mặc định `https://tuturuuu.com`, dùng để dựng đường
  dẫn đăng nhập tập trung.
- `TUTURUUU_EXTERNAL_APP_APPROVAL_URL` — mặc định
  `${TUTURUUU_WEB_APP_URL}/vi/internal/infrastructure/external-apps/approve`,
  chỉ dùng cho thao tác nhanh của quản trị viên khi Tuturuuu từ chối phạm vi
  quyền mới.
- `CYBERSHIELD35_PUBLIC_APP_URL` — origin công khai, dùng khi cấu hình callback
  cho bộ lập lịch. Nếu bỏ trống, hệ thống dùng origin của request hiện tại.
- `TUTURUUU_AI_APP_URL` — mặc định `https://ai.tuturuuu.com`. Dùng để dựng liên
  kết **Mức dùng AI** ở thanh bên, đưa thẳng tới trang mức dùng của đúng workspace
  này trên Tuturuuu AI Studio. Nếu chưa cấu hình workspace, liên kết được ẩn.
- `TUTURUUU_AI_APP_TOKEN` và `TUTURUUU_AI_WORKSPACE_ID` — **máy định danh** cho
  phần chạy nền. Xem [Chi phí AI đi qua đâu](#chi-phí-ai-đi-qua-đâu): thiếu hai
  biến này thì chấm rủi ro, soạn nháp và tóm tắt xu hướng không được tính vào
  mức dùng của workspace.
- `TUTURUUU_AI_BASE_URL` — mặc định `https://tuturuuu.com/api/v1/external-ai`.
- `TUTURUUU_AI_MODEL` — mô hình mặc định, phải nằm trong danh sách workspace cho
  phép; nếu không, cổng từ chối với `MODEL_NOT_ALLOWED`.
- `CYBERSHIELD35_SEED_SOURCE_URLS` — danh sách nguồn khởi tạo, ngăn cách bằng dấu
  phẩy. Để trống theo mặc định: những trang một đơn vị theo dõi là thông tin
  nghiệp vụ, không phải thuộc tính của phần mềm, nên không nằm trong mã nguồn.
- `AUTH_LOCAL_BYPASS=true` — chỉ bỏ qua kiểm tra phiên khi request đến từ
  localhost và `NODE_ENV` khác `production`. Production luôn yêu cầu phiên hợp lệ.

### Phạm vi quyền

CS35 yêu cầu các phạm vi quyền sau khi đăng nhập, khai báo trong mã nguồn:
`workspace:session`, `ai:use`, `tts:use`, `workspace:members:read`,
`workspace:members:write`, `workspace:roles:read`, `workspace:roles:write`,
`workspace:cron:read`, `workspace:cron:write`, `workspace:drive:read`,
`workspace:drive:write`, `external-projects:manage`, `users:profile:read`,
`users:profile:write`. **Không** cấu hình phạm vi quyền trên trình duyệt.

## Tài khoản tên đăng nhập + mật khẩu

Dành cho người vận hành chưa có tài khoản Tuturuuu. Quản trị viên workspace cấp
và quản lý toàn bộ vòng đời tại trang **Thành viên**.

```mermaid
sequenceDiagram
    actor Admin as Quản trị viên<br/>(phiên Tuturuuu)
    participant CS35
    participant DB as Postgres
    actor User as Người vận hành

    Admin->>CS35: Cấp tài khoản (tên đăng nhập, vai trò)
    CS35->>CS35: Sinh mật khẩu ngẫu nhiên 20 ký tự
    CS35->>DB: Lưu hash scrypt (không lưu mật khẩu)
    CS35-->>Admin: Hiện mật khẩu đúng một lần
    Admin-->>User: Bàn giao qua kênh an toàn

    User->>CS35: Đăng nhập lần đầu
    CS35->>DB: Đối chiếu hash, tạo phiên 12 giờ
    CS35-->>User: Bắt buộc đổi mật khẩu

    Note over Admin,DB: Quản trị viên có thể đặt lại mật khẩu,<br/>thu hồi phiên, tắt hoặc xóa tài khoản

    Admin->>CS35: Thu hồi phiên
    CS35->>DB: Đánh dấu revoked_at
    CS35-->>User: Đăng xuất trên mọi thiết bị
```

### So sánh hai loại tài khoản

| | Tài khoản Tuturuuu | Tài khoản mật khẩu |
| --- | --- | --- |
| Cấp bởi | Tuturuuu workspace | Quản trị viên workspace, trong CS35 |
| Thời hạn phiên | Theo refresh token của Tuturuuu | 12 giờ |
| Toàn bộ quy trình 5 bước | Có | Có |
| Trợ lý AI | Qua cổng AI của Tuturuuu | Qua khóa LLM cấu hình sẵn trên máy chủ |
| Quản lý tài khoản mật khẩu | Có, nếu có quyền quản lý thành viên | Không |
| Tệp đính kèm Chat, hồ sơ, bản đọc | Có | Không |

Tài khoản mật khẩu không có danh tính trên Tuturuuu, nên trợ lý AI dùng
`LLM_API_KEY`, `OPENAI_API_KEY` hoặc `GOOGLE_GENERATIVE_AI_API_KEY` của máy chủ —
những biến vốn đã bắt buộc. Các chức năng thật sự cần token Tuturuuu sẽ trả về
thông báo rõ ràng thay vì lỗi chung chung.

### Bảo vệ

- Mật khẩu băm bằng **scrypt** (N=16384, r=8, p=1), mỗi tài khoản một salt riêng;
  cơ sở dữ liệu không bao giờ chứa mật khẩu gốc.
- Sai mật khẩu 5 lần liên tiếp khóa tài khoản 15 phút. Thông báo lỗi khi đăng
  nhập luôn giống nhau để không lộ tài khoản nào đang tồn tại.
- Cookie chỉ chứa mã phiên đã mã hóa; cơ sở dữ liệu chỉ lưu **hash** của mã đó,
  nên rò rỉ dữ liệu không thể dùng lại làm cookie.
- Đổi mật khẩu hoặc đặt lại mật khẩu sẽ thu hồi mọi phiên khác ngay lập tức.
- Chính sách mật khẩu: tối thiểu 12 ký tự, có chữ hoa, chữ thường và chữ số.

## Tích hợp bên ngoài

- **Thu thập dữ liệu** — `APIFY_TOKEN`, `FIRECRAWL_API_KEY`,
  `BROWSER_USE_API_KEY`. Khi tài khoản hết hạn mức, lượt quét dừng ngay kèm lý do
  cụ thể thay vì thử lại vô ích.
- **Zalo Official Account** — `ZALO_APP_ID`, `ZALO_APP_SECRET`,
  `ZALO_REDIRECT_URI`, `ZALO_TOKEN_ENCRYPTION_KEY`, `ZALO_OA_ENABLED`. Giới hạn
  của Zalo: tiêu đề tối đa 150 ký tự, trích yếu tối đa 300 ký tự.
- **Lịch chạy tự động** — Vercel Cron, cần `CRON_SECRET`. Có hai công việc: quét
  nguồn hằng ngày và đẩy hàng đợi xuất bản Zalo mỗi 5 phút.

## Vận hành

Trang **Nhật ký** ghi lại mọi thao tác. Khi một lượt quét hoặc một lần đăng bài
thất bại, hệ thống hiển thị nguyên nhân thật kèm việc cần làm, chứ không chỉ báo
"có lỗi".

Nếu màn hình đăng nhập báo thiếu hoặc sai cấu hình trên Vercel:

- Mở Project Settings → Environment Variables.
- Đặt đủ biến môi trường bắt buộc cho Production và Preview.
- Đặt các bí mật runtime như `DATABASE_URL`, `APIFY_TOKEN`, `FIRECRAWL_API_KEY`,
  `BROWSER_USE_API_KEY`.
- Triển khai lại bản `main` mới nhất sau khi đổi biến môi trường.
- Kiểm tra `TUTURUUU_API_BASE_URL` có kết thúc bằng `/api/v1` không, và
  `CYBERSHIELD35_APP_SECRET` đã được đặt ở phía máy chủ chưa.

---

# English version

**Stakeholder:** [Công an phường Ea Kao](https://zalo.me/2629920369363080604) ·
**Developer & technology provider:** [Tuturuuu](https://tuturuuu.com)

> **Competition entry.** CyberShield 35 forms part of a submission to
> [AI For Life — ai.daklak.gov.vn](https://ai.daklak.gov.vn).

### Contents

| Section | Answers |
| --- | --- |
| [What CyberShield 35 does](#what-cybershield-35-does) | What the product is for |
| [Architecture](#architecture) | The pieces and how data moves |
| [The five-step workflow](#the-five-step-workflow) | What a working day looks like |
| [How a scan runs](#how-a-scan-runs) | States, the three-run cap, what gets retried |
| [Where AI spend goes](#where-ai-spend-goes) | Why AI usage may be under-reported |
| [The trend summary is stored](#the-trend-summary-is-stored) | Why the analysis page opens instantly |
| [How the data is stored](#how-the-data-is-stored) | The core tables and their relations |
| [How risk levels are decided](#how-risk-levels-are-decided) | Who scores content, and on what |
| [Server setup](#server-setup) | Getting it running |
| [Authentication](#authentication) | Sign-in and environment variables |
| [Username + password accounts](#username--password-accounts) | Access for people without Tuturuuu |
| [External integrations](#external-integrations) | Apify, Zalo OA, scheduling |
| [Operations](#operations) | Where to look when something breaks |

## What CyberShield 35 does

CS35 monitors public social media sources, scores every collected item for risk,
and helps editors draft evidence-grounded responses and publish them to a Zalo
Official Account.

The core principle is that **the machine proposes and a person decides**. Nothing
reaches the public automatically. A draft can be staged on Zalo as a hidden
article for review, but it only becomes visible after someone approves it and
publishes it.

## Architecture

```mermaid
flowchart LR
    subgraph src["Public sources"]
        FB["Facebook pages<br/>and groups"]
        WEB["Websites, URLs"]
    end

    subgraph collect["Collection"]
        APIFY["Apify"]
        FIRE["Firecrawl"]
        BU["Browser Use"]
    end

    subgraph core["CyberShield 35"]
        QUEUE["Scan queue<br/>scan_jobs · 3 concurrent at most"]
        WF["Vercel Workflows<br/>durable runs, own retries"]
        DB[("Postgres · Neon")]
        LLM["Risk scoring, analysis<br/>via Tuturuuu AI"]
        EDITOR["Evidence-grounded<br/>drafting"]
    end

    subgraph out["Outputs"]
        ZALO["Zalo OA"]
        FILES["Word, PDF,<br/>audio reading"]
    end

    FB --> APIFY
    WEB --> FIRE
    WEB --> BU
    QUEUE --> WF
    WF --> APIFY
    WF --> FIRE
    WF --> BU
    APIFY --> DB
    FIRE --> DB
    BU --> DB
    DB --> LLM
    LLM --> DB
    DB --> EDITOR
    EDITOR -->|"human approval"| ZALO
    EDITOR --> FILES
```

Vercel Cron drives two scheduled jobs: a **daily source scan** (00:00 UTC) and a
**Zalo publication queue drain** every five minutes.

A scan runs as a *durable workflow* rather than inside a request: it waits on an
external crawler and two model calls, which is more than one request's budget
should hold, and a durable run survives a deploy landing mid-scan.

## The five-step workflow

```mermaid
flowchart LR
    S1["1 · Sources & scans"] --> S2["2 · Timeline"]
    S2 --> S3["3 · Analysis"]
    S3 --> S4["4 · Articles"]
    S4 --> S5["5 · Publishing"]
    S5 -.->|"newly discovered sources"| S1
```

1. **Sources & scans** — register the pages, groups or URLs to watch. Work is
   queued and run, showing plainly whether a scan is waiting, running or done.
2. **Timeline** — everything collected, in time order, with a risk level and the
   reasoning behind it.
3. **Analysis** — the wider picture: risk composition, causes, prominent topics
   and the sources producing them.
4. **Articles** — draft a response from the evidence, with AI assistance. Every
   AI proposal is reviewed before it is applied.
5. **Publishing** — stage a hidden version on the Zalo OA to check it, approve
   it, then make it public. Articles can also be downloaded as Word, PDF or a
   Vietnamese audio reading.

## How a scan runs

```mermaid
stateDiagram-v2
    [*] --> queued: source added or schedule due
    queued --> running: a slot is free
    queued --> queued: at capacity, waits its turn

    running --> completed: collected, scored,<br/>analysed, topics attached
    running --> retrying: transient fault
    running --> failed: terminal fault

    retrying --> running: automatic retry
    retrying --> failed: retry budget spent

    failed --> queued: operator presses Retry
    running --> retrying: stalled past 30 min,<br/>queue reclaims it

    completed --> [*]
```

Six stages per run: **Queue → Collect → Store evidence → Analyse → Attach topics
→ Complete**. Each records its own progress, so a run that stops halfway shows
where it stopped.

**Three concurrent runs at most.** Apify bills memory across every run on one
account, so five in flight reaches the ceiling and the sixth is refused outright.
The cap applies to the schedule and to **Scan now** alike — pressing it when
three are already running queues the scan rather than reporting an error.

**Which faults are worth retrying.** An exhausted memory ceiling or a rate limit
is transient and clears when another run finishes, so it is retried. An exhausted
spend cap, a rejected token or a source that is no longer public is not: retrying
burns the queue while the real fix is to top up the account or correct the
configuration. For runs that have stopped for good, **Retry** re-queues with the
attempt counter reset — still subject to the same cap.

## Where AI spend goes

```mermaid
flowchart TD
    subgraph interactive["With a user present"]
        CHAT["Chat inside CS35"]
    end
    subgraph batch["With no user present"]
        SCAN["Risk scoring during scans"]
        DRAFT["Drafts and articles"]
        SUM["Trend summary"]
    end

    CHAT -->|"the reader's own<br/>app session"| GW["Tuturuuu AI Gateway<br/>ai.tuturuuu.com"]
    SCAN --> MACHINE{"Machine credential<br/>configured?"}
    DRAFT --> MACHINE
    SUM --> MACHINE
    MACHINE -->|"Yes"| GW
    MACHINE -->|"No"| DIRECT["Straight to the provider<br/>not billed to the workspace"]

    GW --> METER["Counted in the workspace's<br/>usage and cost"]
```

Chat borrows the reader's own session, so it always reaches the gateway and is
always counted. Batch work has no session to borrow — it needs a **machine
credential**, declared as `TUTURUUU_AI_APP_TOKEN` and `TUTURUUU_AI_WORKSPACE_ID`.

> **Without those two set, the heaviest use is not counted.** Scoring thousands
> of items, every draft and every summary run on a direct provider key and never
> appear under **AI usage**. The system works either way — the fallback is
> deliberate so scanning does not stop while the credential is issued — but the
> cost figures are missing exactly the largest part.

## The trend summary is stored

```mermaid
flowchart TD
    OPEN["Open the analysis page"] --> READ[("Read the stored row<br/>intelligence_summaries")]
    READ --> HAS{"Anything stored?"}
    HAS -->|"No"| GEN["Generate once,<br/>then store"]
    HAS -->|"Yes · about 100ms"| SERVE["Serve to the reader"]
    GEN --> SERVE

    CRON["Daily scheduled run"] --> FP{"Fingerprint<br/>still matching?"}
    FP -->|"Matches"| SKIP["Skip — no model call"]
    FP -->|"Differs"| REGEN["Regenerate and overwrite"]
    REGEN --> READ
```

The summary lives **in the database**, not in a cache. Each stored row carries a
*fingerprint* of what it was computed from — the evidence count and newest
timestamp in the window. A matching fingerprint means nothing has been collected
since, so the stored answer is still correct and no model call can improve it. A
completed scan moves the fingerprint, and that is the only thing that triggers
regeneration.

The page therefore opens more or less instantly, and the model runs only when the
data has actually changed.

## How the data is stored

```mermaid
erDiagram
    tracked_sources ||--o{ scan_jobs : "schedules"
    sources ||--o{ scan_jobs : "describes"
    scan_jobs ||--o{ evidence_items : "collects"
    scan_jobs ||--o| analyses : "concludes"
    evidence_items ||--o{ evidence_topics : "tagged by"
    topics ||--o{ evidence_topics : "groups"
    evidence_items ||--o| evidence_triage : "triaged as"
    evidence_items ||--o{ articles : "grounds"
    articles ||--o{ article_publication_jobs : "published via"
    facebook_page_profiles ||--o{ evidence_items : "classifies source of"
```

`tracked_sources` is the list of followed sources and the home of a page's
**name** — every screen reads the name from here and prints the `@handle` beneath
it. `evidence_items` holds normalised content with its risk level, sentiment and
stance. `articles` are the responses a person writes, and reach Zalo only through
`article_publication_jobs` after somebody approves them.

## How risk levels are decided

```mermaid
flowchart TD
    ITEM["Collected item"] --> RULES["Offline rule engine<br/>runs at collection time"]
    RULES --> STORE[("Row written to the database")]
    STORE --> HAS{"Language model<br/>configured?"}
    HAS -->|"Yes"| MODEL["Model rescores<br/>and overrides"]
    HAS -->|"No"| KEEP["Rule engine result<br/>stands"]
    MODEL --> WHY["Shown with its reasoning:<br/>signals, subject areas,<br/>decider, confidence"]
    KEEP --> WHY
```

A language model is the authoritative classifier. The offline rule engine is a
fallback: it runs at collection time, before rows exist, and whenever no model is
configured.

Everywhere a risk level appears it carries its reasoning — which signal groups
matched, what subject areas they relate to, whether a model or the rule engine
decided, and with what confidence. It is a **review priority**, not a verdict.

## Server setup

Run Postgres and the app services with Docker:

```bash
cp .env.example .env
docker compose up --build
```

Local development:

```bash
bun install
bun run db:migrate
bun run dev
```

Common commands:

| Command | Purpose |
| --- | --- |
| `bun run build` | Production build, including type checking |
| `bun test` | Run the full test suite |
| `bun run typecheck` | Type-check the application |
| `bun run typecheck:test` | Type-check the test suite |
| `bun run lint` | Run ESLint |
| `bun run worker` | Run the queue worker |
| `bun run db:generate` | Generate a migration from schema changes |
| `bun run db:migrate` | Apply migrations |
| `bun run db:reclassify-risk` | Re-score risk for existing data |
| `bun run db:regenerate-headlines` | Rewrite titles and excerpts |

## Authentication

CS35 accepts two kinds of credential. Both produce a session held in an encrypted
HttpOnly cookie, and neither **ever** asks operators to type app credentials,
provider keys or LLM secrets in the browser.

```mermaid
flowchart TD
    USER["Operator"] --> CHOICE{"Credential"}

    CHOICE -->|"Tuturuuu"| TTR["Centralized login<br/>at tuturuuu.com"]
    TTR --> VERIFY["/verify-token exchanges the<br/>handoff token server-side"]
    VERIFY --> SESS_T["Cookie<br/>cybershield35_admin_session"]

    CHOICE -->|"Password"| PWD["Username + password"]
    PWD --> LOGIN["/api/auth/local/login<br/>verifies the scrypt hash"]
    LOGIN --> SESS_L["Cookie<br/>cybershield35_local_session"]

    SESS_T --> APP["CS35 dashboard"]
    SESS_L --> APP

    APP --> PLATFORM{"Feature needs a<br/>Tuturuuu token?"}
    PLATFORM -->|"Yes"| ONLY_T["Tuturuuu sessions only:<br/>chat attachments, profile,<br/>member management, audio"]
    PLATFORM -->|"No"| BOTH["Either session"]
```

Administrative authority always originates at Tuturuuu: only a Tuturuuu session
that Tuturuuu itself reports as a workspace member-manager can issue or revoke
password accounts.

### Tuturuuu accounts

When auth is configured but no session exists, the app shows a
`Đăng nhập bằng Tuturuuu` button. That sends the operator to Tuturuuu centralized
login and returns to `/verify-token`, where CS35 exchanges the short handoff
token server-side through `/api/auth/verify-app-token`.

### Required environment

- `TUTURUUU_API_BASE_URL` — must end in `/api/v1`
- `TUTURUUU_CYBERSHIELD35_WORKSPACE_ID`
- `CYBERSHIELD35_APP_ID`
- `CYBERSHIELD35_APP_SECRET`
- `DATABASE_URL`

### Optional environment

- `CYBERSHIELD35_SESSION_SECRET` — only when cookie encryption should rotate
  independently of `CYBERSHIELD35_APP_SECRET`. Falls back to it when unset. This
  key seals **both** session cookies, so rotating it signs everyone out.
- `TUTURUUU_WEB_APP_URL` — defaults to `https://tuturuuu.com`, used to build the
  centralized login URL.
- `TUTURUUU_EXTERNAL_APP_APPROVAL_URL` — defaults to
  `${TUTURUUU_WEB_APP_URL}/vi/internal/infrastructure/external-apps/approve`,
  used only for the admin quick action when Tuturuuu rejects newly requested app
  scopes.
- `CYBERSHIELD35_PUBLIC_APP_URL` — public origin used when scheduler callbacks
  are configured. Falls back to the current request origin.
- `TUTURUUU_AI_APP_URL` — defaults to `https://ai.tuturuuu.com`. Used to build the
  sidebar's **Mức dùng AI** link, which opens this workspace's usage page on the
  Tuturuuu AI Studio. The entry is hidden when no workspace is configured.
- `TUTURUUU_AI_APP_TOKEN` and `TUTURUUU_AI_WORKSPACE_ID` — the **machine
  credential** for work with no user attached. See
  [Where AI spend goes](#where-ai-spend-goes): without both, risk scoring,
  drafting and the trend summary are not billed to the workspace.
- `TUTURUUU_AI_BASE_URL` — defaults to `https://tuturuuu.com/api/v1/external-ai`.
- `TUTURUUU_AI_MODEL` — the default model. It must be one the workspace permits,
  or the gateway rejects the call with `MODEL_NOT_ALLOWED`.
- `CYBERSHIELD35_SEED_SOURCE_URLS` — comma-separated seed sources. Empty by
  default: which pages a unit follows is operational information about an
  investigation, not a property of the software, so it does not live in the
  repository.
- `AUTH_LOCAL_BYPASS=true` — skips the session check only when the request host
  is localhost/loopback and `NODE_ENV` is not `production`. Production always
  requires a valid session.

### Requested scopes

CS35 requests these code-owned external-app scopes at login: `workspace:session`,
`ai:use`, `tts:use`, `workspace:members:read`, `workspace:members:write`,
`workspace:roles:read`, `workspace:roles:write`, `workspace:cron:read`,
`workspace:cron:write`, `workspace:drive:read`, `workspace:drive:write`,
`external-projects:manage`, `users:profile:read`, `users:profile:write`. Do
**not** configure requested scopes in the browser.

## Username + password accounts

For operators who have no Tuturuuu account. Workspace admins issue and manage the
whole lifecycle from the **Members** page.

```mermaid
sequenceDiagram
    actor Admin as Workspace admin<br/>(Tuturuuu session)
    participant CS35
    participant DB as Postgres
    actor User as Operator

    Admin->>CS35: Issue account (username, role)
    CS35->>CS35: Generate a random 20-character password
    CS35->>DB: Store the scrypt hash only
    CS35-->>Admin: Reveal the password exactly once
    Admin-->>User: Hand it over out of band

    User->>CS35: First sign-in
    CS35->>DB: Verify hash, open a 12-hour session
    CS35-->>User: Force a password change

    Note over Admin,DB: Admins can reset the password, revoke<br/>sessions, disable or delete the account

    Admin->>CS35: Revoke sessions
    CS35->>DB: Stamp revoked_at
    CS35-->>User: Signed out on every device
```

### The two account types

| | Tuturuuu account | Password account |
| --- | --- | --- |
| Issued by | The Tuturuuu workspace | A workspace admin, inside CS35 |
| Session lifetime | The Tuturuuu refresh token | 12 hours |
| Full five-step workflow | Yes | Yes |
| AI assistance | Through the Tuturuuu AI gateway | Through the server's own LLM key |
| Manages password accounts | Yes, with member-management rights | No |
| Chat attachments, profile, audio | Yes | No |

A password account has no Tuturuuu identity, so AI assistance falls back to the
server's `LLM_API_KEY`, `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` —
which are required configuration anyway. Features that genuinely need a Tuturuuu
token return an explicit message instead of a generic failure.

### Protections

- Passwords are hashed with **scrypt** (N=16384, r=8, p=1) under a per-account
  salt; the database never holds a plaintext password.
- Five consecutive failures lock the account for 15 minutes. The login error is
  always identical, so it never reveals which usernames exist.
- The cookie carries only an encrypted session token, and the database stores
  only its **hash**, so leaked rows cannot be replayed as a cookie.
- Changing or resetting a password revokes every other session immediately.
- Password policy: at least 12 characters, with upper case, lower case and a
  digit.

## External integrations

- **Collection** — `APIFY_TOKEN`, `FIRECRAWL_API_KEY`, `BROWSER_USE_API_KEY`.
  When an account runs out of quota, scans stop immediately with the specific
  reason rather than retrying pointlessly.
- **Zalo Official Account** — `ZALO_APP_ID`, `ZALO_APP_SECRET`,
  `ZALO_REDIRECT_URI`, `ZALO_TOKEN_ENCRYPTION_KEY`, `ZALO_OA_ENABLED`. Zalo's own
  limits: 150 characters for a title, 300 for an excerpt.
- **Scheduling** — Vercel Cron, requires `CRON_SECRET`. Two jobs: a daily source
  scan and a Zalo publication queue drain every five minutes.

## Operations

The **Audit log** records every action. When a scan or a publish fails, the app
shows the real cause and what to do about it rather than a generic error.

If the login screen reports missing or invalid configuration on Vercel:

- Open Project Settings → Environment Variables.
- Set the required environment for Production and Preview.
- Set runtime secrets such as `DATABASE_URL`, `APIFY_TOKEN`,
  `FIRECRAWL_API_KEY` and `BROWSER_USE_API_KEY`.
- Redeploy the latest `main` build after changing environment variables.
- Verify that `TUTURUUU_API_BASE_URL` ends in `/api/v1` and that
  `CYBERSHIELD35_APP_SECRET` is set server-side.
