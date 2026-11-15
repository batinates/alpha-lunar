# İniş alanı arşivi

**Arazi ve aylık referans verileri** bölümü 22 koordinatta yaklaşık 2 km’lik eğim haritası, yükseklik, yerel eğim ve 100 m çevre istatistiklerini gösterir. Haritadaki artı işareti GeoTIFF koordinat dönüşümüyle yerleştirilmiş saha merkezidir. Piksel aralığı ve DEM’in etkin çözünürlüğü farklı ölçülerdir.

Ocak 2023–Aralık 2029 arasında seçilen ay için ortalama görünür Güneş ve Dünya disk oranı, Güneş’e dönük panele gelen enerji ve en uzun görünmezlik süreleri okunabilir. Doğuş-batış olayları 2 m gözlemci için diskin ilk ve son görünür kenarına göre modellenmiştir. Zaman duyarlılığı ufkun 0,1° değiştiği kaynak senaryoyu ifade eder. Aralık 2029 kapsamı son 10 dakikayı içermez. Model çıktıları görev ekranlarında kullanılan SPICE/LOLA sonuçlarından ayrı bir arşiv referansıdır.

Tarayıcı türevlerini `python scripts/ingest_archive_context.py "data folder"` üretir. NumPy ve Pillow gerekir. `public/lunar/site-archive/context/manifest.json` dosyasında kaynak ve çıktı sağlama toplamları bulunur. Katalog ve 22 ufuk profili paketlenmiş arşivle eşleşti.

**Landing Site Archive** 25 kayıt içerir. Her kayıtta bulunan hedef ve gerçekleşen konum, olay türü, kaynak bağlantısı ve varsa alan sınırı gösterilir. Koordinatı olan 22 kayıt haritada açılır. Üç kayıtta koordinat, açı serisi ve ufuk profili bulunmaz. Planlanan görev tarihleri güncel bir takvim olarak sunulmaz. Blue Moon / Endurance konumu arşivde varsayılan bölge merkezidir. Chang’e-7 noktası düşük güvenli hedef tahminidir.

22 koordinat için 1 Ocak 2023 00:00–31 Aralık 2029 23:00 UTC arasında kesintisiz 61.368 saatlik örnek vardır. Güneş ve Dünya azimut/yükselim değerleri 0,01° adımla, konuma göre ayrı dosyalarda saklanır ve seçim üzerine yüklenir. Aynı koordinatı ve tamamen aynı açı/ufuk verisini kullanan Connecting Ridge ile Blue Moon kayıtları bir veri dosyasını paylaşır.

Örtüşen dönemde 385.462 konum-saat, mevcut DE421 tablosundan hesaplanan açılarla karşılaştırıldı. Azami mutlak farklar Güneş azimutunda 0,01171°, yükseliminde 0,00676°, Dünya azimutunda 0,00400°, yükseliminde 0,00389° altında kaldı. Kontrol, örtüşen tarihlerdeki sayısal uyumu ölçer. Orijinal Parquet üretim modeli ve örtüşme dışındaki tarihler için bağımsız doğrulama yoktur.

Topografya paketi 2 m gözlemci yüksekliği için 0,25° aralıklarla örneklenmiş 22 ufuk profili içerir. DEM kaynağı, tarama yöntemi ve azimut başına tam kapsam dosyada tanımlanmamıştır. Arşivdeki açı farkları keşif amaçlıdır. Mevcut iniş ve haberleşme motorları kendi DEM ve SPICE modellerinden yararlanır. Desteklenen bölgelerde **Screen this coordinate** arşiv noktasını mevcut aday taramasına taşır. Katalogda gösterilen bölge merkezleri ve sınırlar, tüm bölgenin tarandığı anlamına gelmez.

```bash
python -m pip install numpy pyarrow
python scripts/ingest_site_archive.py veriler
```

Ham dosyalar çalışma klasöründe kalır. Tarayıcı yalnızca türetilmiş katalog, seçili konumun sıkıştırmaya uygun ikili açı serisi ve ufuk profilini ister. Girdilerin SHA-256 özetleri ve karşılaştırma sonuçları `public/lunar/site-archive/manifest.json` içindedir.

Konum kaynakları arasında [USGS dokuz Artemis aday bölgesi veri yayını](https://www.usgs.gov/data/down-selected-artemis-iii-candidate-landing-site-navigational-grids), [önceki aday bölgelerin USGS arşivi](https://data.usgs.gov/datacatalog/data/USGS%3A67168797d34ebf903f48b6fc) ve [NASA Ay araçları ve çarpma noktaları tablosu](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) bulunur.
