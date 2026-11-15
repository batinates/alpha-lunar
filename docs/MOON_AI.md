# Moon AI

Ay Gezgini’nin altındaki Moon AI menüsü sohbeti açar. Sohbet açıkken harita çizimi duraklar. **Yeni sohbet** ayrı bir konuşma başlatır. **Sohbet geçmişi** listesinden ilk mesajı ve son güncelleme zamanı görünen bir konuşmayı açıp devam edebilirsin.

Gönderilen sorular, tamamlanan cevaplar ve ilgili araç düğmeleri tarayıcının IndexedDB alanına kaydedilir. Geçmiş aynı tarayıcı profili ve site adresinde sayfa yenilendiğinde geri yüklenir. Diğer tarayıcılar, cihazlar ve sitenin diğer alan adı kendi geçmişlerini tutar. Tarayıcının site verilerini temizlemek bu kayıtları siler. Moon AI erişim kodu sayfa oturumunun belleğinde tutulur.

Claude, Ay sahası araması, iniş sıralaması, arşiv ve Diviner incelemesi, Monte Carlo iniş simülasyonu ve yüzey operasyonu karşılaştırması için ALPHA LUNAR’ın mevcut araçlarını kullanır. Açılış düğmeleri, desteklenen araçları ilgili saha ve mevcut çalışma verisiyle açar. Simülasyon ve risk pencereleri hesaplanmış senaryoyu devralabilir. Görev raporu oluşturma işlemi mevcut kullanıcı kontrollerinden yapılır.

## Yerel kurulum

1. `.env.example` dosyasını `.env.local` olarak kopyalayın.
2. Yeni Anthropic API anahtarını `ANTHROPIC_API_KEY` alanına girin. Ayrı ve rastgele bir erişim kodunu `MOON_AI_ACCESS_TOKEN` alanına yazın. Erişim kodu, Claude anahtarından farklıdır.
3. `pnpm dev` çalıştırın. Moon AI’da **Erişim** düğmesinden yalnızca erişim kodunu girin. Kod sekmenin belleğinde tutulur. API anahtarı Vite sunucusunda kalır.

Üretim derlemesini yerelde incelemek için `pnpm build` ardından `pnpm preview` çalıştırın. API, aynı kaynaktaki `/api/moon-ai` yolunda çalışır. İstemci yalnızca sohbet metnini, seçili görev bağlamını ve araç özetlerini bu yola gönderir. Sayısal modeller tarayıcıdaki mevcut worker’larda çalışır. Varsayılan model Claude Sonnet 5.5’tir. Gerekirse sunucuya `ANTHROPIC_MODEL` verilebilir.

## Canlı ortam

ChatGPT Sites paketi için `pnpm build:sites` komutunu çalıştırın. Arayüz `dist/client`, Worker `dist/server` altında oluşur. Aynı adresteki `/api/moon-ai` çağrıları Worker’a ulaşır. `ANTHROPIC_API_KEY` ve `MOON_AI_ACCESS_TOKEN` değerlerini Sites ortamında gizli değer olarak tanımlayın. Kullanıcı Moon AI’ın **Erişim** alanına yalnızca kendi erişim kodunu girer.

## Bilimsel kapsam

Simülasyon, verilen varsayımlarla eşikleri aşan örnekleri sayar. Kutup arazisindeki çözünürlük, araç boyutundaki tehlikeleri belirlemeye yetmez. Diviner ve kalıcı gölge, olası soğuk tuzak koşulları hakkında veri verir. Yerel buz miktarı ancak doğrudan kanıt bulunduğunda tahmin edilebilir. LCROSS ölçümü kendi çarpma sahasına aittir.
