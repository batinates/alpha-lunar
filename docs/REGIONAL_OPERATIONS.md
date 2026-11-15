# Bölgesel arazi ve Dünya haberleşmesi

**Mission Overview**, aktif görevi, aracı, seçili koordinatı ve UTC zamanını gösterir. Görev yapılandırması, aday tarama, haberleşme, iniş simülasyonu ve raporlar aynı ekran üzerinden açılabilir.

**Earth Communication**, seçili koordinat için SPICE kaynaklı Dünya merkezi yönünü ve uzaklığını kullanır. Frekans, verici gücü, iki anten kazancı, ek kayıplar ve alıcı hassasiyeti düzenlenebilir. Alınan güç, verici gücü ve kazançların toplamından serbest uzay ve girilen ek kayıpların çıkarılmasıyla bulunur. Marj, alınan gücün alıcı hassasiyetine göre farkıdır. Varsayılan değerler örnek çalışma girdileridir. [ITU-R P.525-5](https://www.itu.int/rec/R-REC-P.525-5-202411-I/en).

85°G–90°G aralığında 160 m LOLA üzerinden hesaplanan 100 km yerel ufuk, geometrik taramaya katılır. Bir saatlik örnek hem yerel açıklık hem alıcı hassasiyeti koşulunu karşıladığında model sınırlarını karşılar. Yetersiz arazi kapsamı ayrı işaretlenir. CSV, saatlik geometriyi, bütçe girdilerini ve sonucu içerir. Pencereler örnek saatlerine dayanır. Yer istasyonu, röle, anten yönlendirme, Doppler ve atmosfer koşulları için ek modelleme gerekir.

**DSN stations** sekmesinde Goldstone DSS-14, Madrid DSS-63 ve Canberra DSS-43 için ayrı görüş pencereleri hesaplanır. Ay tarafında seçilen antenin yönü 100 km arazi ufkuyla, Dünya tarafında Ay yüzeyindeki hedefin yükselim açısı istasyon eşiğiyle karşılaştırılır. Varsayılan 10° eşik bir çalışma varsayımıdır. Alıcı kazancı istasyona göre düzenlenebilir. 2026–2028 UTC aralığında 10 dakikalık tarama geometrik görüşü ve bağlantı marjını birlikte gösterir. Anten tahsisi her örnekte doğrulanmamış olarak kaydedilir. [JPL 810-005 istasyon koordinatları](https://deepspace.jpl.nasa.gov/dsndocs/810-005/Binder/810-005_Binder_Change42.pdf)

Dünya dönüşü NAIF ITRF93 çekirdeklerinden türetilmiştir. Yönelim verisi, kaynak çekirdekleri ve SHA-256 özetleri `public/lunar/dsn-orientation.json` içinde listelenir. Çekirdekleri `.cache/validation` klasörüne indirip `python scripts/prepare_dsn.py` ile türevi yeniden üretebilirsin. JPL Horizons ile Ay merkezi yükselimi 12 örnekte karşılaştırıldı ve her örnek 0,02° test eşiğini karşıladı. Model eşzamanlı geometrik yön kullanır. [NAIF yönelim çekirdekleri](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/) · [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html)

**Regional Terrain Detail**, Connecting Ridge, Shackleton Rim ve de Gerlache Rim için 16 × 16 km bölgeler sunar. Bölge önce 80 m aralıklı yaklaşık 80 kB veriyle çizilir. Yakınlaştırınca 20 m aralıklı yaklaşık 1,28 MB veri istenir. Veriler NASA PGDA’nın 5 m LOLA GeoTIFF ürünlerinden alan ortalamasıyla türetildi. Sahne görsel inceleme için kullanılır. Görev taraması ve simülasyon karşılaştırılabilirliği korumak için 160 m DEM kullanır. [NASA PGDA 5 m LOLA ürünleri](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/).

| Bölge | Ortak hücre | Yükseklik RMSE | Eğim RMSE |
| --- | ---: | ---: | ---: |
| Connecting Ridge | 9.900 | 0,63 m | 0,12° |
| Shackleton Rim | 9.801 | 1,18 m | 0,21° |
| de Gerlache Rim | 9.801 | 0,65 m | 0,14° |

Karşılaştırmada 5 m kaynaklar 160 m hücrelere ortalandı ve eğim için 320 m fark açıklığı kullanıldı. İki veri seti de LOLA gözlemlerine dayanır. Sonuçlar üç alanı ve eşleştirilmiş çözünürlüğü kapsar. Kaynak ve çıktı özetleri, sınırlar ve ayrıntılı ölçümler `public/lunar/regional/manifest.json` içindedir.

```bash
python -m pip install numpy tifffile
python scripts/validate_terrain.py 01 04 11 --export
```
