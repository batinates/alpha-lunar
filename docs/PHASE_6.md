# Phase 6 · İniş simülasyonu ve risk analizi

**Landing Simulation** Güney Kutbu’ndaki seçili koordinat ve aktif araçla açılır. **Landing Optimization → Simulate descent** seçeneği, adayın koordinatını, UTC varışını ve taramada kullanılan görev profilini taşır. Adayın Güneş ve Dünya merkezi açıklığı, Diviner yüzey tepesi ve modellenen soğuk tuzak yakınlığı risk tablosuna eklenir.

## Model

Giriş hızı ve alçalma açısı yatay ve düşey hız bileşenlerini belirler. Sabit irtifa farkı için model, sabit frenleme ile iki bileşeni temas anında sıfıra indirir. Süre, giriş irtifasının iki katının düşey giriş hızına bölünmesiyle bulunur. Kütle ve 1,62 m/s² sabit yerçekimiyle gerekli itkinin normu hesaplanır ve girilen itkiyle karşılaştırılır. İtki yetersizse nominal yol, gereken manevranın görseli olarak kalır ve ilgili denemeler sınır aşımı olarak işaretlenir. Yön ve yatay uzaklıklar kutupsal izdüşüm düzleminde yaklaşık uygulanır.

İniş sahnesi 160 m LOLA türevini, 81 örnekli yaklaşma yolunu, bölgesel tarama karesini, teorik bivariyat normal %95 elipsini ve örneklenen iniş noktalarını gösterir. Zaman kaydırıcısı ve oynatma düğmesi aynı nominal yolu kullanır. Temas örneği yaklaşma açıklığının minimumuna dahil edilmez.

## Monte Carlo ve yorum

Sabit tohumla bağımsız normal dağılımlardan pist boyunca ve enine sapma ile giriş hızı sapması örneklenir. Negatif örnek hızları hesaplama için düşük pozitif sınıra çekilir. Aynı rastgele çekilişlerle üç durum karşılaştırılır: başlangıç ayarları, yaklaşma yönünde +45° ve navigasyon sapmalarında %30 azalma. Sapmalı rota, örneklenen temas yüksekliğine taşınır. Her deneme arazi teması, bölgesel karenin dışına çıkma, temas eğimi, tarama karesinin azami RMS pürüzlülüğü ve gerekli itki açısından değerlendirilir. Bir denemede birden çok risk oluşabilir. Bilinen bir aşım bulunmadığında eksik DEM veya eğim örneği olan deneme çözümsüz kalır.

Yüzdeler girilen dağılım ve model koşullarına bağlıdır. Monte Carlo, gerçek araç telemetrisi ile kalibre edilmiş arıza olasılıkları üretmez. Risk tablosundaki şiddet, kanıt ve azaltım önerileri ön incelemeye yöneliktir. Dünya merkezi açıklığı radyo bağlantısını, Güneş merkezi açıklığı üretilen gücü, Diviner yüzey tepesi donanım sıcaklığını ölçmez. Yakıt tüketimi, motor geçişleri, tutum kontrolü, yörüngeden iniş ve uçuş doğrulaması kapsam dışındadır.

Veri kaynakları için [Phase 4](PHASE_4.md), aday varış yöntemi için [Phase 5](PHASE_5.md).
## İniş noktasından gökyüzü

İniş oynatımı tamamlandığında kamera nominal temas noktasının 2 m üstüne geçer. **Dünya’ya bak** ve **Güneş’e bak** kamerayı cisimlerin geometrik merkezlerine yöneltir. İniş zamanı, simülasyon başlığındaki UTC zamandır. Kaydırıcı mevcut veri kapsamı içinde sonraki 72 saate kadar ilerler.

Yönler 2026–2028 SPICE/DE421 verisinden yerel gözlemci paralaksıyla hesaplanır. Dünya ve Güneş, mesafeden türetilen açısal çapla çizilir. 160 m LOLA verisinden örneklenen ufuk, Ay eğriliğini hesaba katar ve 100 km’ye kadar taranır. Yakın arazi gerçek ölçekle, uzak sırtlar örneklenen ufuk profiliyle çizilir. Ufuk örneklemesi tamamlanmamış bir doğrultuda görünürlük belirsiz kalabilir.

Dünya’nın yüzey yönelimi mevcut JPL ITRF93 dönüşlerinden, aydınlık ve karanlık yüzü Güneş yönünden hesaplanır. Görsel doku, 2004 Nisan küresel mozaiğinin tarayıcı türevidir. [NASA Earth Observatory · Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/)
