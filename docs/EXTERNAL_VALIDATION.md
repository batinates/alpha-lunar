# Dış referanslarla bilimsel doğrulama

**Dokümantasyon → Bilimsel doğrulama** bölümünde üç bölgenin toplu ve ayrı sonuçları, CSV örnekleri, kaynak sorguları ve SHA-256 özetleri bulunur. Bu sonuçların kısa özeti **Space Apps sunumu** bölümündedir.

**JPL Horizons.** Connecting Ridge, Shackleton Rim ve de Gerlache Rim çalışma pencerelerinin merkezinde, 160 m DEM yüksekliğine 2 m eklenerek gözlemci tanımlandı. 2026 ve 2027’nin Ocak ve Temmuz ayları ile 1 Şubat ve 15 Kasım 2028’den başlayan toplam altı yedi günlük pencere kullanıldı. Altı saat aralıklı örnekler saatin 30. dakikasına gelir. Cisim başına 522, toplam 1.044 eşleşme vardır. 2028’deki 348 eşleşmede en büyük yön farkı Güneş için 0,005934°, Dünya için 0,000293° olarak ölçüldü. [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) yüksek hassasiyetli Mean Earth çerçevesinde DE441 ve kırılmasız görünür yerel Az/El (miktar 4) kullanıyor. Uygulama interpolasyonla SPICE/DE421 **geometrik** yönü hesaplıyor. Fark ışık zamanı, aberasyon, efemeris ve çerçeve farklarını içerir. Azimut farkı ±180°’ye sarılır. Yön farkı iki görüş doğrultusu arasındaki açıdır.

| Cisim | Azimut RMSE | Yükselim RMSE | En büyük yön farkı |
| --- | ---: | ---: | ---: |
| Güneş | 0,00569° | 0,00014° | 0,00598° |
| Dünya | 0,00020° | 0,00006° | 0,00030° |

**NASA PGDA.** [NASA PGDA 69](https://pgda.gsfc.nasa.gov/products/69) 60 m Güneş ve Dünya görünürlük haritalarından üç bölgede 5×5 düzenli pikseller seçildi (360 m aralık). Model, aynı piksel merkezlerinde sıfır direk yüksekliği, 160 m LOLA arazi ve 100 km ufuk kullandı. Diski oluşturan herhangi bir parça ufku aşıyorsa örnek görünür sayıldı. SPICE/DE421 ile 2026-01-01’den başlayan yaklaşık 18,6 yıl için 27.175 adet altı saatlik dilim ortası hesaplandı. Bu ayrı koşu uygulamanın görev tarihi kapsamını genişletmez. Karşılaştırmaya yalnızca tam kapsanan noktalar girer; bu koşuda cisim başına 75 noktanın tamamı kapsandı. Referans, PDS etiketinin 0,00004 DN ölçeği ve sıfır tabanlı piksel merkezi referansıyla okundu.

| Cisim | Ortalama mutlak fark | Ortalama sapma (model − PGDA) | En büyük mutlak fark |
| --- | ---: | ---: | ---: |
| Güneş | 2,77 yp | +2,76 yp | 7,91 yp |
| Dünya | 2,94 yp | +2,89 yp | 12,67 yp |

Sonuçlar üç yerel pencereyi kapsar. PGDA farklı dönem ve çözünürlük kullanan ayrı bir modeldir. İki model de LOLA gözlemlerine dayanır. Bu ölçüm uzun dönem görünürlüğüyle sınırlıdır. [Mazarico vd. (2011)](https://doi.org/10.1016/j.icarus.2010.10.030)

**Tarihli LROC WAC kontrolü.** Shackleton Rim’de iki görüntünün her birinde 6.400 örnek, parlaklığa göre aydınlık veya gölge olarak sınıflandırıldı. Sınıflar, görüntünün zaman aralığının ortasındaki SPICE Güneş yönü ve 100 km arazi ışınlarından hesaplanan sınıflarla %85,6 ve %68,6 oranında eşleşti. Bu değerler iki yerel gözlemle sınırlıdır. [Ürünler ve örnek sayıları (JSON)](https://alphaspace.com.tr/lunar/validation/lroc.json)

Yeniden üretmek için raporun `pgda` alanındaki IMG ve LBL dosyalarını aynı klasöre indir. `python -m pip install numpy spiceypy` ve `python scripts/prepare_validation_geometry.py` ile sabitlenmiş NAIF çekirdeklerinden uzun dönem önbelleğini oluştur. Node 24 ile `node scripts/validate_external.mjs <PGDA-klasörü>` çalıştır. Başarılı Horizons yanıtları `.cache/validation` altında saklanır. Horizons veri sürümü zamanla değişebilir; ham yanıtların SHA-256 özetleri ve dönüşen sonuçlar rapora kaydedilir.
