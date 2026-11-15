# Phase 4 · Güney Kutbu bilimsel arazi analizi

Güney Kutbu sahnesinde sol menüden **Terrain Intelligence**, **Thermal Analysis** veya **Water Ice & Resources** açılır. Yüzeye tıklayın ya da aramadan bir konum seçin. Her katmanın renk açıklaması ve seçili koordinatın bilimsel verileri birlikte gösterilir.

| Modül | Veri ve yöntem | Yorum sınırı |
| --- | --- | --- |
| Arazi | İnterpole edilmiş LOLA 40 m DEM'in 160 m türevi. Eğimin merkezi fark açıklığı 320 m. Pürüzlülük 3 × 3 örnekte her noktaya uydurulan düzlemden RMS sapması. Kullanıcının karesindeki örneklenen en yüksek değerler eşiklerle karşılaştırılır. | 320–2.560 m karede bölgesel ön eleme. Araç ayak izi, kayalar, yaklaşma koridoru ve iniş dinamiği kapsam dışı. Düşey görsel ölçek hesaplara katılmaz. |
| Termal | Diviner gözlemlerinden türetilen Schorghofer ve Williams sıcaklık ızgaraları. 240 m girdiler 480 m tarayıcı hücresine dönüştürülür. Tepe, kesişen kaynak hücrelerinin en yüksek değeri. Ortalama, kesişen izdüşüm alanlarıyla ağırlıklandırılır. | Bunlar klimatolojik yüzey özetleri. Saatlik sıcaklık, minimum, termal maruziyet süresi ve donanım sıcaklığı bu sürümde yok. Tepe eşik içinde kaldığında alt sınır için kesin sonuca varılamaz. |
| Su buzu | Diviner tepe sıcaklığı <110 K olan hücreler termal soğuk tuzak adayları. 60 m LOLA aydınlatma modeli, her 480 m hücre içindeki kalıcı gölge payını verir. LCROSS'un Cabeus püskürme bulutunda su tespit ettiği konum ayrı işaretlenir. | Termal eşik ve gölge yüzdesi ortam koşullarını gösterir. M³ piksel envanteri, hidrojen haritası ve rezerv miktarı dahil edilmedi. Gözlemsel kapsam LCROSS noktasıyla sınırlı. |

Güven bilgisi hücre bazında kaynak türü, çözünürlük, veri yokluğu ve Diviner kaynak komşuluğundaki en düşük dolu örnekleme dilimi sayısıyla gösterilir. Dataverse dizin adı ve GMT dosya içi başlığı örnekleme düzeni konusunda farklı olduğundan arayüz bir yüzde veya toplam dilim sayısı üretmez. Diviner ile LOLA eşleştirmesi ortak küresel yarıçap ve 0° merkez meridyeni üzerinden yapılır. Bağımsız ince ölçekli eş konum doğrulaması beklemektedir.

## Veriyi yeniden üretme

```bash
python -m pip install numpy scipy
python scripts/ingest_polar_environment.py
pnpm test
pnpm build
```

İçe aktarma, sabitlenmiş yayımlanmış kaynakları `data-source/` içinde önbelleğe alır. Diviner dosyalarını yayıncı MD5 değerleriyle kontrol eder, izdüşüm ızgaralarını doğrular ve `public/lunar/polar-environment.bin` dosyasını üretir. Kaynak bağlantıları, dönüşüm ayrıntıları, SHA-256 ve gözlem koordinatı `public/lunar/polar-environment.json` içinde bulunur. Tarayıcı derleme sırasında dış kaynağa bağlanmaz.

- [Diviner veri yayını](https://doi.org/10.7910/DVN/EGOOCL)
- [NASA LOLA kalıcı gölge ürünleri](https://pgda.gsfc.nasa.gov/products/69)
- [M³ su buzu gözlemleri ve termal eleme referansı](https://pmc.ncbi.nlm.nih.gov/articles/PMC6130389/)
- [NASA LCROSS gözlemi](https://science.nasa.gov/image-detail/20110615lcross/)
- [LCROSS konum ve belirsizlik çalışması](https://arxiv.org/abs/1103.1687)
