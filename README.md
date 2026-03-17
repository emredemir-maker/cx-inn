# CX-Inn — AI-Powered B2B Customer Experience Platform

<div align="center">

![CX-Inn](https://img.shields.io/badge/CX--Inn-B2B%20CX%20Platform-6366f1?style=for-the-badge)
![Gemini AI](https://img.shields.io/badge/Gemini%202.5%20Flash-AI%20Engine-4285F4?style=for-the-badge&logo=google)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=for-the-badge&logo=postgresql)

**Müşteri etkileşimlerini AI ile analiz eden, NPS/CSAT tahmin eden ve kişiselleştirilmiş kampanyalar oluşturan kurumsal CX platformu.**

</div>

---

## Genel Bakış

CX-Inn, B2B şirketlerin müşteri deneyimini ölçmek ve iyileştirmek için geliştirilen AI destekli bir platformdur. Gemini 2.5 Flash motoru sayesinde her müşteri etkileşimini otomatik analiz eder; NPS/CSAT tahminleri üretir, churn riskini tespit eder ve kişiselleştirilmiş kampanyalar önerir.

---

## Özellikler

### 🤖 Gemini AI Analiz Motoru
- Her müşteri etkileşimi için otomatik **NPS (0–10) ve CSAT (1–5) tahmini**
- **Duygu analizi** (pozitif / negatif / nötr)
- **Churn riski** değerlendirmesi (düşük / orta / yüksek)
- **Ağrı noktası** etiketleme ve kategorizasyon
- **Anomali tespiti** — beklenmedik müşteri davranışları için anlık uyarı

### 📊 CX Analiz Raporu
- Aylık AI tahmin trendi grafikleri
- Ağrı noktası → NPS etkisi analizi
- Duygu dağılımı → NPS korelasyonu
- AI tahmin doğruluğu (MAE) — gerçek anket yanıtlarıyla karşılaştırma
- Tüm metriklerde tanım tooltipleri ve **Metrik Tanımları** kılavuz bölümü

### 📋 Sıfır-Anket Motoru (Zero-Survey Engine)
- Anket göndermeden, mevcut etkileşim verisinden otomatik CX skoru üretimi
- Tüm kanallar pasif olarak izlenir; manuel anket sıfıra iner

### 🎯 Müşteri Segmentasyon
- AI destekli otomatik segment oluşturma
- Churn riski, NPS bandı, duygu durumu bazlı filtreleme
- Segment bazlı kampanya hedefleme

### 📧 Hyper-Personalized E-posta Kampanyaları
- Gemini AI ile her müşteriye özel konu satırı ve e-posta gövdesi
- Drag-and-drop blok editörü
- Onay akışı entegrasyonu — yayın öncesi zorunlu onay

### 📝 Anket Yönetimi
- Sürükle-bırak anket oluşturma
- NPS, CSAT, açık uçlu soru tipleri
- Kamuya açık yanıt sayfası (`/survey/:id`)
- Gerçek yanıtlar AI tahminleriyle karşılaştırılır → doğruluk döngüsü

### 👥 Rol Tabanlı Erişim Kontrolü (RBAC)
| Rol | Yetkiler |
|-----|---------|
| **Süper Admin** | Tüm özellikler + kullanıcı yönetimi + sistem ayarları |
| **CX Manager** | Anket/kampanya onaylama, raporlar, müşteri yönetimi |
| **CX Kullanıcısı** | Etkileşim girişi, taslak oluşturma (onay bekler) |

### ✅ Onay Akışı
- CX User tarafından oluşturulan anket ve kampanyalar otomatik onay kuyruğuna düşer
- Manager onay / red + revizyon notu
- Durum izleme: Taslak → Onay Bekliyor → Yayında / Reddedildi

### 👤 Kullanıcı Yönetimi & Davet Sistemi
- E-posta ile davet gönderme (Resend API)
- İlk Google girişinde davet eşleştirme ve rol atama
- Aktif kullanıcılar, bekleyen davetler, kabul edilmiş davetler arşivi
- Anlık rol değiştirme

### 🔔 NLP Sorgu Paneli
- Doğal dil ile veri sorgulama
- "Bu ay en çok şikayet edilen konu ne?" gibi sorular

### 🔧 REST API & Webhook
- API anahtar yönetimi
- Dış sistemlerden etkileşim gönderme
- Webhook entegrasyonu

### 🔒 Güvenlik
- **Firebase Authentication** — Google OAuth ile güvenli giriş
- **PII Maskeleme** — e-posta, telefon gibi kişisel veriler loglanmaz
- **httpOnly şifreli çerez** oturumu
- Per-request DB rol doğrulaması

### 📖 In-App Kullanım Kılavuzu
- 12 bölümlü kapsamlı kılavuz (`/manual`)
- Tüm metrik tanımları, formüller ve iyi aralıklar
- Rol bazlı adım adım talimatlar
- SSS accordion bölümü

---

## Teknik Mimari

```
cx-inn/
├── artifacts/
│   ├── cx-platform/          # React + Vite frontend (TypeScript)
│   │   └── src/
│   │       ├── pages/        # Sayfa bileşenleri
│   │       ├── components/   # Paylaşılan UI bileşenleri
│   │       ├── context/      # AuthContext (Firebase)
│   │       └── hooks/        # Custom React hooks
│   │
│   └── api-server/           # Express.js backend (TypeScript)
│       └── src/
│           ├── routes/       # API endpoint'leri
│           ├── lib/          # AI analiz, doğruluk hesaplama
│           ├── middlewares/  # Auth middleware (DB rol doğrulama)
│           └── services/     # E-posta servisi (Resend)
│
└── lib/
    └── db/                   # Drizzle ORM şeması (PostgreSQL)
        └── src/schema/       # Tablo tanımları
```

### Teknoloji Yığını

| Katman | Teknoloji |
|--------|----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Wouter |
| Backend | Node.js, Express.js, TypeScript, tsx |
| Veritabanı | PostgreSQL (Replit DB), Drizzle ORM |
| AI | Google Gemini 2.5 Flash |
| Auth | Firebase Authentication (Google OAuth) |
| E-posta | Resend API (`noreply@infoset.app`) |
| Grafik | Recharts (AreaChart, LineChart) |
| Paket Yönetimi | pnpm workspace (monorepo) |

---

## Veritabanı Şeması

Ana tablolar:

| Tablo | Açıklama |
|-------|---------|
| `users` | Kullanıcılar ve roller (superadmin / cx_manager / cx_user) |
| `customers` | Müşteri profilleri, NPS skoru, churn riski |
| `interactions` | Müşteri etkileşim kayıtları |
| `cx_analyses` | Gemini AI analiz sonuçları (predicted_nps, predicted_csat, sentiment) |
| `surveys` | Anket şablonları ve soruları |
| `survey_responses` | Müşteri anket yanıtları |
| `campaigns` | E-posta/anket kampanyaları |
| `invitations` | Kullanıcı davetleri |
| `audit_logs` | İşlem denetim kaydı |

---

## Kurulum

### Gereksinimler
- Node.js 18+
- pnpm 8+
- PostgreSQL veritabanı
- Firebase projesi (Google Auth için)
- Google Gemini API anahtarı

### Ortam Değişkenleri

**API Server** (`artifacts/api-server/.env`):
```env
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
RESEND_API_KEY=...
FIREBASE_PROJECT_ID=...
```

**Frontend** (`artifacts/cx-platform/.env`):
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

### Çalıştırma

```bash
# Bağımlılıkları yükle
pnpm install

# Veritabanı şemasını oluştur
cd lib/db && npx drizzle-kit push

# API sunucusunu başlat (port 8080)
pnpm --filter @workspace/api-server run dev

# Frontend'i başlat
pnpm --filter @workspace/cx-platform run dev
```

---

## API Endpoint'leri

| Method | Endpoint | Açıklama |
|--------|---------|---------|
| `GET` | `/api/dashboard/metrics` | Gösterge paneli metrikleri |
| `GET` | `/api/analytics/overall` | Genel CX analiz özeti |
| `GET` | `/api/analytics/monthly-trend` | Aylık NPS/CSAT trendi |
| `GET` | `/api/analytics/prediction-accuracy` | AI tahmin doğruluğu (MAE) |
| `GET/POST` | `/api/interactions` | Etkileşim kayıtları |
| `POST` | `/api/interactions/import` | CSV toplu içe aktarma |
| `GET/POST` | `/api/surveys` | Anket yönetimi |
| `GET/POST` | `/api/campaigns` | Kampanya yönetimi |
| `GET/POST` | `/api/customers` | Müşteri profilleri |
| `GET/POST` | `/api/invitations` | Kullanıcı davetleri |
| `GET` | `/api/anomalies` | Anomali tespiti |
| `POST` | `/api/gemini/analyze` | Tekil etkileşim analizi |
| `POST` | `/api/gemini/personalize` | Kişiselleştirilmiş e-posta üretimi |

---

## Ekran Görüntüleri

| Sayfa | Açıklama |
|-------|---------|
| `/` | Gösterge Paneli — metrikler, anomali uyarıları, son etkileşimler |
| `/analytics` | CX Analiz Raporu — trend grafiği, ağrı noktaları, duygu analizi |
| `/customers` | Müşteri listesi — segment, churn riski, NPS bazlı filtreleme |
| `/interactions` | Etkileşim kayıtları — CSV içe aktarma, AI analizi tetikleme |
| `/surveys` | Anket yönetimi — oluşturma, onay süreci, yanıt izleme |
| `/campaigns` | Kampanya yönetimi — AI kişiselleştirme, blok editörü |
| `/manual` | Kullanım kılavuzu — 12 bölüm, metrik tanımları, SSS |
| `/user-management` | Kullanıcı yönetimi — davet sistemi, rol atama |

---

## Lisans

Bu proje özel kullanım içindir. Tüm hakları saklıdır.

---

<div align="center">
  <strong>CX-Inn Platform</strong> · Gemini 2.5 Flash ile güçlendirilmiştir · © 2026
</div>
