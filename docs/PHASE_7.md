# Phase 7 · Görev raporlama ve doğrulama

**Landing Optimization** sonuçlarında adayın ayrıntılarını açıp **Create report** seç. İniş simülasyonu da raporda yer alsın istiyorsan **Simulate descent** ile devam et, simülasyonu çalıştır ve raporu oradan oluştur. **Mission Reports** kayıtlı raporları açar. **Print / Save PDF** tarayıcının yazdırma penceresini açar. **Download JSON**, arama aralığını, adayları, elenme nedenlerini, model parametrelerini, sonuçları ve kullanılan veri dosyalarının SHA-256 özetlerini içerir. Raporlar bu tarayıcının yerel depolamasında saklanır.

## Shackleton kenarı arazi karşılaştırması

14 Kasım 2026 kontrolünde, uygulamanın 160 m LOLA dosyası, NASA PGDA'nın Shackleton kenarındaki ayrı Site04 5 m yükseklik ürünüyle karşılaştırıldı. 5 m pikseller 160 m hücre sınırlarında alan ortalamasıyla toplandı. Eğim her iki tarafta aynı 320 m merkezi fark açıklığıyla hesaplandı.

| Ölçüm | Hücre sayısı | RMSE | Mutlak hatanın %95 yüzdelik değeri |
| --- | ---: | ---: | ---: |
| Yükseklik | 9801 | 1.18 m | 2.60 m |
| Eğim | 9409 | 0.21° | 0.45° |

Uygulama verisi eksi referans ortalama yükseklik farkı -0.32 m. İki ürün de LOLA gözlemlerine dayanıyor. Bu kontrol tek bölgeyi ve eşit çözünürlüğe getirilen ölçümleri kapsıyor. Araç ölçeğindeki engeller, başka bölgeler, görüntü eş kaydı ve uçuş performansı bu karşılaştırmanın kapsamı dışında.

```bash
python -m pip install numpy tifffile
python scripts/validate_terrain.py
```

Referans GeoTIFF SHA-256 değeri `38ff70dbdf2f066c2cfa94a646c3a59d653ce7f6b4528b15fc1b43ee397ce758`. [NASA PGDA LOLA 5 m ürünleri](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/).

## Hesap ve performans kontrolleri

Time Explorer ile iniş araması aynı DEM piksel merkezi kapsamını kullanır. SPICE saatlik ara değerleri doğrudan SPICE orta nokta hesabıyla üretim aşamasında karşılaştırılmıştır. Alçalma modelinin sabit 1,62 m/s² yerçekimi girdisi NASA'nın ortalama Ay yüzeyi değeriyle uyumludur. [NASA Ay yüzeyi yerçekimi](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/moon/) · [SPICE yöntemi](PHASE_3.md).

Güney Kutbu sahne modülü ve DEM, küresel görünüm açılırken yüklenmez. Yerel alçalma sahnesi kamera, yörünge veya oynatma konumu değiştiğinde çizilir. Ekran doğrulaması aday seçiminden PDF ve JSON çıktısına kadar rapor akışını kapsar.
