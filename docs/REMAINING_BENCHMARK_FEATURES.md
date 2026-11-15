# Rakip incelemesinden kalan geliştirmeler

Güç ve batarya modeli, Horizons ve PGDA karşılaştırması, yan yana saha karşılaştırması ve istasyon bazlı DSN pencereleri mevcut. Aşağıdaki sıra, incelenen projelerdeki uygulanabilir farkları kapsar.

| Sıra | Geliştirme | Durum ve tamamlanma ölçütü |
| --- | --- | --- |
| 1 | Ufuk geçişleri ve çok çözünürlüklü yakın arazi | Site Comparison, örnekler arasında geçişi daraltır ve 20 m yakın arazi ile 160 m temel modelin zaman farkını gösterir. |
| 2 | Bölgesel ufuk kapsamını genişletme | Site Comparison, 75° enleme kadar NASA LOLA verisiyle 150 veya 300 km tarar. Hedef mesafeye ulaşan ışın sayısını gösterir. |
| 3 | Ortak operasyon zaman çizelgesi ve Kuzey Kutbu | Site Comparison, kuzey ve güney sahalarında üç DSN istasyonunu aynı UTC imlecinde gösterir. Kuzey görünürlüğünün PGDA karşılaştırması bekliyor. |
| 4 | Tarihli LROC doğrulaması | Site04’te iki WAC görüntüsü ve görüntü başına 6.400 nokta karşılaştırıldı. |
| 5 | Veri hızı ve aktarım kapasitesi | DSN istasyon ekranı, düzenlenebilir alıcı sıcaklığı, Eb/N₀ ve radyo sınırıyla potansiyel hız ve hacmi hesaplıyor. |
| 6 | Tutulma, evre ve librasyon | Time Explorer evre, Dünya alt noktası ve Ay merkezi için geometrik tutulma hesabını gösteriyor. Yüzey güç modeli Dünya diskinin geometrik örtülmesini yaklaşık olarak hesaba katıyor. |
| 7 | Arazi ürünleri ve iniş ekranı | Bölgesel yükseklik ve eğim haritaları yan yana. Alçalma ekranında hız, irtifa ve nominal frenleme itkisinin düşeye göre eğimi görülüyor. Araç gövde tutumu ve kontrol dinamiği ayrıca modellenebilir. |

Erişilemeyen GitHub bağlantıları özellik kaynağı olarak kullanılmadı. Siderust geometrik açı örneğinin ve açık yeniden üretim betiklerinin karşılığı mevcut SPICE ve dış doğrulama iş akışında bulunuyor.
