# ALPHA LUNAR Proje Kılavuzu

ALPHA LUNAR, Ay yüzeyini araştırmak, sahaların koşullarını karşılaştırmak ve sonuçları kaynaklı bir görev raporuna dönüştürmek için kullanılan bir web uygulamasıdır. Açık NASA verilerini, bilimsel tarama modellerini ve temsili 3B sahneleri bir araya getirir.

## Kurulum ve arayüz

1. Proje klasöründe `pnpm install` ve `pnpm dev` komutlarını çalıştırın. Terminaldeki yerel adresi açın.
2. Sağ üstteki **TR** ve **EN** düğmeleriyle dili değiştirin. Tercih tarayıcıda saklanır. Ürün kimlikleri ve makine tarafından kullanılan dışa aktarma alanları kaynak dilini korur.
3. **Ay Gezgini** küresel yüzeyi, **Güney Kutbu** bölgesel araziyi açar. Sürükleyerek döndürün, kaydırarak yakınlaşın, yüzeye tıklayarak koordinat seçin. Arama düğmesi IAU/USGS konum dizinini açar.
4. **Veri Entegrasyon Durumu** ekranından ürün etiketlerini, veri kökenini ve sağlama toplamlarını inceleyin. Tarayıcı sekmesi ile uygulama başlığı aynı logoyu kullanır.

## Keşif ve görev araçları

| Araç | Kullanım |
| --- | --- |
| Ay Gezgini ve Güney Kutbu | LROC mozaiği, LOLA yüksekliği, konum araması ve kutup arazisi. |
| Bölgesel Arazi Detayı | Seçili sahalarda 80 m ve 20 m görsel arazi katmanları. |
| İniş Sahası Arşivi ve Ay Görevleri | Tarihsel sahalar ve aday bölgeler. 3B sahnede LRO veya LADEE’ye tıklayınca görev amacı, fırlatma tarihi, işletici, cihazlar ve NASA bağlantısı açılır. |
| Zaman Gezgini | 2026–2028 UTC için Güneş ve Dünya geometrisi, Ay evresi, librasyon ve geometrik tutulma tahmini. |
| Arazi, Termal ve Su Buzu Analizi | Eğim, pürüzlülük, Diviner iklim özeti, kalıcı gölge ve LCROSS noktasal kanıtı. |
| Yüzey Enerjisi ve Dünya ile İletişim | Panel, tüketim, batarya ve radyo varsayımları. DSN istasyon pencereleri ve veri hızı tahmini. |
| Görev Yapılandırması ve İniş Optimizasyonu | Profil, varış penceresi taraması, aday sıralaması ve Pareto alternatifleri. |
| Saha Karşılaştırması | Ortak UTC aralığında ufuk, aydınlanma, batarya, geometrik Dünya görüşü ve radyo marjı. |
| İniş Simülasyonu ve Risk Değerlendirmesi | 3B yaklaşma, yörünge, temas noktası dağılımı ve Monte Carlo senaryoları. |
| Görev Raporları | Girdi ve sonuçları kaydetme, JSON indirme ve tarayıcıdan PDF yazdırma. |

## Artemis görevleri

**Görev Sistemleri → Artemis Fırlatma Sistemi** yolundan NASA kaynaklı görev kartlarını açın. Tarihler plan hedefidir.

| Görev | Hedef | Uygulama içinde |
| --- | --- | --- |
| Artemis III | 2027 | Orion’un alçak Dünya yörüngesindeki Blue Moon Mark 2 ve Starship V3 kenetlenme testleri. Araç kartı ve görev zaman çizelgesi. |
| Artemis IV | 2028 başı | İlk mürettebatlı Artemis Ay inişi. ICPS ve uzatılmış Centaur V değerlendirmede. Starship HLS ve Blue Moon Mark 2 çalışma alternatifleri. |
| Artemis V | 2028 sonu | Standartlaştırılmış SLS ve Ay üssü çalışmalarının başlangıç hedefi. Kesin tarih, yer, üst kademe ve iniş aracı için açıklama bekleniyor. |

IV ve V Zaman Gezgini’ni ve iki sahalı karşılaştırmayı açar. Örnek başlangıçlar 1 Şubat ve 15 Kasım 2028 UTC, varsayılan kalış 72 saattir. Haworth, Mons Mouton ve Nobile Rim 2, NASA’nın 2024 tarihli çalışma bölgeleridir. Nobile Rim 2’nin ayrıntılı eğim, termal ve gölge alanlarında kapsam eksikleri bulunur.

[NASA görev planı güncellemesi](https://www.nasa.gov/missions/artemis/nasa-shares-plans-to-accelerate-artemis-return-to-moon/) · [Artemis V](https://www.nasa.gov/event/artemis-v/) · [2024 saha çalışması](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)

## İniş simülasyonu

Güney Kutbu’nda kapsanan bir konum seçin veya İniş Optimizasyonu sonucundan simülasyona geçin. Görev profilinin kütle ve tarama karesiyle yaklaşma parametrelerini belirleyin. Simülasyonu çalıştırın. Apollo Ay Modülü veya kavramsal iniş roketini seçin, takip kamerası ile yörünge görünümü arasında geçin ve zaman çizelgesinden temas anını açın.

İniş alanı, Güney Kutbu atlasıyla aynı LOLA verisini, gri yüzey malzemesini, kabartma dokusunu ve inceleme ışığı açısını kullanır. Bölgesel 3B görünüm Ay eğriliğini ve çevredeki kraterleri gösterir. Sarı halka nominal temas noktasını, altındaki ölçümler hedefin enlem, boylam ve yükseltisini gösterir. Apollo Ay Modülü seçilen çalışma sahasında temsili araçtır. Tarihsel Apollo inişleri Ay Görevleri ekranında haritalanır. Dikey kabartma ve araç büyütme fizik hesabını değiştirmez. Monte Carlo senaryoları aynı tohumla tekrarlanabilir.

## Veriler ve bilimsel doğrulama

| Ürün | Kullanılan kapsam |
| --- | --- |
| LROC ve LOLA | Küresel renk ve rölyef. LDEM_85S_40M V2.0, 40 m kaynak, 160 m bölgesel ızgara. Genişletilmiş ufuk kapsamı 480 m. |
| SPICE DE421 / MOON_ME_DE421 | 2026–2028 UTC. Saatlik vektörler ve ara değerleme. |
| Diviner V3 | 480 m tarayıcı türevi. İklimsel ortalama ve tepe sıcaklığı. Türevde kesin gözlem aralığı bulunmaz. |
| LPSR_85S_060M_201608 V1.05 | 60 m kalıcı gölge modeli, 480 m hücre özetleri. Su buzu değerlendirmesi ayrı gözlemsel kanıt gerektirir. |

2028’e ait 348 yön örneği JPL Horizons ile karşılaştırıldı. En büyük doğrultu farkı Güneş’te yaklaşık 0,005934°, Dünya’da 0,000293°. Uygulama geometrik açıyı, Horizons karşılaştırması görünür açıyı kullanır. PGDA uzun dönem görünürlük karşılaştırması ayrı bir çalışmadır. Bu karşılaştırmalar batarya, radyo performansı veya araç ölçeğindeki iniş güvenliğini doğrulamaz.

[Yöntem ve doğrulama](EXTERNAL_VALIDATION.md) · [Mimari](ARCHITECTURE.md) · [Saha karşılaştırması](SITE_COMPARISON.md) · [Güç modeli](SURFACE_POWER.md) · [Radyo ve DSN](REGIONAL_OPERATIONS.md) · [İniş ve risk](PHASE_6.md) · [Raporlama](PHASE_7.md)

## Geliştirme ve veri üretimi

React ve TypeScript arayüzü, Three.js sahneleri ve bilimsel servis katmanı üzerinden çalışır. Ufuk, saha karşılaştırması, optimizasyon ve simülasyon hesapları arka plan iş parçacıklarında yürür. `public/lunar/` tarayıcı verilerini ve manifestoları, `scripts/` veri hazırlama hattını içerir. Normal derleme NASA verilerini indirmez. Yerel kontrol için `pnpm check`, `pnpm test`, `pnpm build` ve `pnpm preview` komutlarını kullanın.
