# ALPHA LUNAR — Proje Durum Raporu ve Kullanım Dokümantasyonu

> 13 Kasım 2026 güncellemesi: Phase 3 zaman geometrisi kilometre taşı eklendi. Güneş simgesiyle UTC zaman gezgini, SPICE Güneş/Dünya ufuk açıları ve 28 günlük grafik açılır. Ayrıntılar: [Phase 3](PHASE_3.md). Aşağıdaki Phase 2 raporu önceki teslimatın kaydıdır.

**Doküman sürümü:** 2.0  
**Tarih:** 12 Kasım 2026  
**Aktif geliştirme fazı:** Phase 2 — NASA Surface Atlas

## Yönetici özeti

ALPHA LUNAR, Ay yüzeyini ve ileride eklenecek görev analizlerini tek bir izlenebilir çalışma alanında birleştirmek üzere geliştirilen web tabanlı bir dijital ikiz ve görev istihbaratı platformudur.

Bugün Phase 1 tamamlanmıştır. Phase 2'nin NASA yüzey verisi alma, doğrulama ve 3B görselleştirme çekirdeği çalışmaktadır. Bilimsel iniş güvenliği, aydınlatma zamanı, termal koşul, su-buzu, optimizasyon ve simülasyon motorları henüz etkin değildir; sonraki fazlarda doğrulanabilir veri ve yöntemlerle eklenecektir.

## Bugüne kadar geliştirilenler

1. Profesyonel koyu havacılık tasarım sistemi ve responsive görev konsolu.
2. Fare, dokunmatik ve akıcı kamera kontrolüne sahip etkileşimli küresel 3B Ay.
3. IAU/USGS Gazetteer temelli önemli oluşum adları, koordinatları ve kaynak bağlantıları.
4. Konum arama, yüzey koordinatı seçme, kamera sıfırlama, etiket ve koordinat ızgarası kontrolleri.
5. 85°G–90°G için özel Güney Kutbu keşif modu.
6. NASA LROC 8K görsel mozaiği ve global LOLA yükselti tabanlı yüzey rölyefi.
7. 40 m kaynaklı LOLA Güney Kutbu DEM ürününden üretilen 160 m tarayıcı rasterı ve yaklaşık 474 m mesh örnek aralığı.
8. Gerçekçi yüzey, görsel rölyef ve LOLA yükselti renk katmanları.
9. Kaynak ürün, yeniden örnekleme ve dosya checksum bilgilerini tutan provenance manifestosu.
10. Koordinat, polar projeksiyon, raster örnekleme ve dosya bütünlüğü otomatik testleri.

## 7 fazlık geliştirme planı

### Phase 1 — Görsel temel ve 3B Ay — Tamamlandı

Tasarım sistemi, küresel 3B Ay, kamera/konum seçimi, coğrafi etiketler ve Güney Kutbu keşif deneyimi.

### Phase 2 — NASA yüzey atlası — Aktif

LROC/LOLA veri hattı, gerçek yüzey katmanları, provenance, yüksek çözünürlüklü kutup arazisi. Sonraki adım: çok seviyeli detay (LOD), karo akışı ve daha geniş kutup ürün kataloğu.

### Phase 3 — Aydınlatma ve görünürlük — Planlandı

SPICE tabanlı tarih/saat geometrisi, Güneş açısı, arazi gölgeleri, aydınlık süreleri ve Dünya iletişim görüş hattı.

### Phase 4 — Bilimsel arazi zekâsı — Planlandı

Eğim, pürüzlülük, termal koşullar, kalıcı gölge bölgeleri, su-buzu kanıt katmanları, belirsizlik ve güven puanları.

### Phase 5 — Görev yapılandırma — Planlandı

Araç/mürettebat/güç/iletişim kısıtları, görev profilleri, aday bölge karşılaştırması ve çok ölçütlü iniş optimizasyonu.

### Phase 6 — İniş simülasyonu ve risk — Planlandı

Monte Carlo koşuları, iniş elipsi ve saçılım, risk kayıtları ve senaryo karşılaştırması.

### Phase 7 — Raporlama ve doğrulama — Planlandı

Görev raporları, bilimsel doğrulama, performans, erişilebilirlik, operasyon ve geliştirici belgeleri.

## Programın kullanımı

### Küresel Ay görünümü

- Fareyle sürükleyerek Ay çevresinde dönün.
- Tekerlek veya dokunmatik hareketle yakınlaştırın.
- Yüzeye tıklayarak enlem/boylam seçin.
- Arama düğmesiyle indekslenmiş bir oluşuma gidin.
- Yüzey, Rölyef ve Yükselti katmanları arasında geçiş yapın.
- Etiket ve koordinat ızgarasını açıp kapatın.
- Yörünge simgesiyle kamerayı başlangıç konumuna döndürün.

### Güney Kutbu görünümü

- `SOUTH POLE` anahtarını kullanın.
- Shackleton ve diğer dizinlenmiş landmark'ları seçin.
- 1× gerçek ölçek veya 2×/3× görsel düşey büyütmeyi seçin.
- Inspection Light ile arazi biçimini görünür hâle getirin.
- Yükselti renk katmanında −10/+12 km referans lejandını kullanın.

Inspection Light astronomik zaman simülasyonu değildir. Mevcut sürüm iniş güvenliği veya görev uygunluğu kararı vermez.

## Teknik mimari

Veri akışı beş katmandan oluşur:

1. **Kaynak:** NASA/PDS/USGS — LROC, LOLA ve IAU Gazetteer.
2. **Ingest:** Decode, koordinat/projeksiyon dönüşümü, yeniden örnekleme, metadata ve checksum.
3. **Atlas:** Web uyumlu texture, DEM, mesh türevleri ve provenance manifestosu.
4. **Dijital ikiz:** React, TypeScript, Three.js ve React Three Fiber tabanlı sahneler.
5. **Gelecek analiz servisleri:** SPICE, arazi/termal/kaynak analizi, risk, optimizasyon ve raporlar.

Sunum, domain, veri servisleri ve 3B sahne bileşenleri birbirinden ayrılmıştır. Bu yapı yeni NASA ürünlerinin görsel arayüzü yeniden yazmadan eklenebilmesini hedefler.

## NASA / Artemis bağlamındaki olası rol

ALPHA LUNAR aşağıdaki görevlerde destek platformu olabilir:

- Aday Güney Kutbu bölgelerinin 3B ön keşfi ve teknik brifingi.
- LRO/PDS veri ürünlerinin aynı referans çerçevesinde birleştirilmesi.
- Gelecekte görev kısıtlarına göre aday bölge ve senaryo karşılaştırması.
- Bilim, mühendislik, yönetim ve kamu iletişimi arasında ortak görsel dil.
- Karar ürünlerinde kaynak, yöntem, sürüm ve belirsizlik izinin korunması.

ALPHA LUNAR şu anda NASA tarafından onaylanmış, uçuşa uygun, emniyet-kritik veya operasyonel bir sistem değildir. Resmî bir NASA iş akışına alınması için veri/model doğrulama ve geçerleme, siber güvenlik, erişilebilirlik, yapılandırma yönetimi ve yetkili teknik incelemeler gerekir.

## Bilimsel veri ve sınırlar

- LROC renk yüzeyi, NASA SVS CGI Moon Kit görselleştirme mozaiğidir ve kutupsal infill içerir.
- LOLA topografyası ölçümlerden ızgaralanmış ve interpolasyon uygulanmış bir üründür.
- Tarayıcıda kullanılan türevler performans için yeniden örneklenmiştir.
- Ayarlanabilir ışık bilimsel Güneş konumu değildir.
- Bilimsel analiz eklenmeden iniş alanı uygunluğu, risk veya kaynak çıkarımı yapılmaz.

## Resmî kaynaklar

- NASA LRO: https://science.nasa.gov/mission/lro/
- NASA LRO araçları: https://science.nasa.gov/mission/lro/spacecraft-and-instruments/
- NASA Moon to Mars Architecture: https://www.nasa.gov/architecture/
- NASA PDS LOLA: https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- IAU/USGS Gazetteer: https://planetarynames.wr.usgs.gov/
- NASA SVS CGI Moon Kit: https://svs.gsfc.nasa.gov/4720/
