# Phase 5 · Görev planlama ve iniş optimizasyonu

**Mission Configuration** menüsünde görevi, aracı ve analiz eşiklerini düzenleyin. Robotik ve Artemis Mode şablonları birer çalışma senaryosudur. Kütle ve mürettebat sayısı araç profilinde saklanır. Bu bilgiler henüz iniş dinamiğine girdi olarak kullanılmaz. Kaydedilen profiller aynı tarayıcıda tekrar yüklenebilir.

**Landing Optimization** menüsünde tam saat olarak ilk ve son UTC varışını seçin. Tarih aralığı en fazla 28 gündür. Planlanan yüzey kalış süresinin tamamı 2026–2028 SPICE veri aralığı içinde kalmalıdır. Arama seçili koordinatı, kayıtlı kutup yer işaretlerini ve kutup merkezli 20 km ızgarayı tarar. Örnek noktalar çalışma adaylarıdır. [NASA Artemis program bağlamı](https://www.nasa.gov/mission/artemis-iv/).

- Arazi eşikleri, seçilen 320–3.200 m bölgesel karedeki azami örnek eğimi ve düzlemden RMS pürüzlülüğü üzerinden uygulanır. Araç ayak izi ve tekil engeller bu DEM’in çözebildiği ölçeğin altındadır.
- Varışlar 6 saatte bir, Güneş ve Dünya merkezlerinin açıklığı varıştan görev sonuna kadar saatte bir örneklenir. LOLA ufku 160 m aralık, 1° azimut ve 100 km yarıçapla hesaplanır. Kesintiye uğramış bir yönde mevcut arazinin engellemediği örnek belirsiz sayılır ve açıklık oranına eklenmez. Zaman örnekleri arasındaki geçişler ve 100 km ötesi arazi çözümlenmez.
- İsteğe bağlı termal eşik Diviner’ın klimatolojik yüzey tepesini kullanır. Anlık sıcaklık, donanım sıcaklığı ve maruziyet süresi ayrı değerlendirme gerektirir. Bilim hedefi, 10 km içindeki modellenmiş termal soğuk tuzaklara izdüşüm yakınlığıdır. Arazi geçilebilirliği ve su buzu miktarı kapsam dışında kalır.
- Uygun seçenekler arazi marjı, Güneş açıklığı, Dünya açıklığı ve soğuk tuzak yakınlığıyla sıralanır. Arayüz ağırlıkları, Pareto cephesini, ölçüt bazındaki liderleri ve elenme nedenlerini gösterir. Bir aday seçilince harita ve Time Explorer ilgili UTC varışına gider.

Bu aşamanın çıktısı bölgesel görev ön elemesidir. Kesintisiz aydınlatma, elektrik üretimi, radyo bağlantısı, EVA erişimi ve uçuş güvenliği daha ayrıntılı modeller ve doğrulama gerektirir. Kullanılan kaynaklar için [Phase 3](PHASE_3.md) ve [Phase 4](PHASE_4.md) yöntem notlarına bakın.
