import {
  ArrowRight, BookOpen, Check, ChevronRight, CircleDashed, Database, ExternalLink,
  FileCheck2, Layers3, Map, MousePointer2, Orbit, Rocket, Search, ShieldCheck,
  Sparkles, Sun, X,
} from 'lucide-react'
import type { ExplorerMode } from '../domain/lunar'

type DocumentationCenterProps = {
  open: boolean
  onClose: () => void
  onExplore: (mode: ExplorerMode) => void
}

const phases = [
  {
    no: '01', status: 'complete', label: 'TAMAMLANDI', title: 'Görsel temel ve 3B Ay',
    summary: 'Profesyonel arayüz, küresel 3B Ay, konum seçimi, etiketler ve Güney Kutbu keşif modu.',
    items: ['Karanlık havacılık tasarım sistemi', 'Etkileşimli küresel Ay ve kamera', 'IAU/USGS konum dizini', 'Güney Kutbu komuta görünümü'],
  },
  {
    no: '02', status: 'active', label: 'AKTİF', title: 'NASA yüzey atlası',
    summary: 'LROC ve LOLA kaynaklarının doğrulanabilir bir veri hattıyla gerçek zamanlı 3B yüzeye dönüştürülmesi.',
    items: ['LROC 8K küresel mozaik', 'LOLA küresel yükselti', '40 m kaynaklı kutup DEM ürünü', 'Kaynak manifestosu ve checksum doğrulaması'],
    next: 'Sıradaki: çok seviyeli detay (LOD), karo akışı ve daha geniş kutup ürün kataloğu.',
  },
  {
    no: '03', status: 'planned', label: 'PLANLANDI', title: 'Aydınlatma ve görünürlük',
    summary: 'Tarih/saat kontrollü Güneş geometrisi, arazi gölgeleri ve Dünya görüş hattı.',
    items: ['SPICE zaman/geometri çekirdeği', 'Güneş açısı ve gölge süresi', 'Dünya iletişim görünürlüğü', 'Zaman çizelgesi karşılaştırması'],
  },
  {
    no: '04', status: 'planned', label: 'PLANLANDI', title: 'Bilimsel arazi zekâsı',
    summary: 'Eğim, pürüzlülük, termal koşullar, kalıcı gölge ve su-buzu kanıt katmanları.',
    items: ['Arazi güvenlik metrikleri', 'Diviner termal katmanları', 'PSR ve uçucu madde katmanları', 'Belirsizlik ve güven puanı'],
  },
  {
    no: '05', status: 'planned', label: 'PLANLANDI', title: 'Görev yapılandırma',
    summary: 'Araç, mürettebat, güç, iletişim ve bilim hedefleriyle aday bölge karşılaştırması.',
    items: ['Görev profilleri', 'Uzay aracı kısıtları', 'Artemis araştırma görünümü', 'Çok ölçütlü iniş optimizasyonu'],
  },
  {
    no: '06', status: 'planned', label: 'PLANLANDI', title: 'İniş simülasyonu ve risk',
    summary: 'Dağılım, sapma ve sistem belirsizliklerini değerlendiren tekrarlanabilir senaryolar.',
    items: ['Monte Carlo koşuları', 'İniş elipsi ve saçılım', 'Risk kayıtları', 'Senaryo karşılaştırması'],
  },
  {
    no: '07', status: 'planned', label: 'PLANLANDI', title: 'Raporlama ve doğrulama',
    summary: 'Karar izini, performansı ve bilimsel kaynakları bir araya getiren son ürün katmanı.',
    items: ['Görev raporu üretimi', 'Bilimsel doğrulama', 'Performans ve erişilebilirlik', 'Operasyon ve geliştirici belgeleri'],
  },
]

const glossary = [
  ['DEM', 'Digital Elevation Model — yüzey yüksekliğini düzenli bir ızgarada temsil eden sayısal model.'],
  ['LRO', 'Lunar Reconnaissance Orbiter — Ay yüzeyini haritalayan NASA yörünge görevi.'],
  ['LOLA', 'Lunar Orbiter Laser Altimeter — lazer ölçümleriyle topografya ve yükseklik üreten LRO aracı.'],
  ['LROC', 'Lunar Reconnaissance Orbiter Camera — yüksek çözünürlüklü Ay görüntülerini sağlayan kamera sistemi.'],
  ['PDS', 'Planetary Data System — NASA gezegen bilimi verilerinin uzun dönemli arşivi.'],
  ['IAU', 'International Astronomical Union — gezegen oluşumlarının resmî adlandırma otoritesi.'],
  ['PSR', 'Permanently Shadowed Region — doğrudan Güneş ışığı almayan kalıcı gölge bölgesi.'],
  ['SPICE', 'Uzay aracı, gök cismi, zaman ve referans çerçevesi geometrisini hesaplayan NAIF sistemi.'],
  ['LOD', 'Level of Detail — kameraya göre yalnızca gerekli çözünürlüğü yükleyen detay seviyesi sistemi.'],
  ['Monte Carlo', 'Belirsiz girdileri çok sayıda örnekleyerek sonuç dağılımı üreten simülasyon yaklaşımı.'],
]

export function DocumentationCenter({ open, onClose, onExplore }: DocumentationCenterProps) {
  if (!open) return null

  const goExplore = (mode: ExplorerMode) => {
    onExplore(mode)
    onClose()
  }

  return (
    <div className="docs-shell" role="dialog" aria-modal="true" aria-label="ALPHA LUNAR Dokümantasyon Merkezi">
      <header className="docs-topbar">
        <a className="docs-wordmark" href="#overview" aria-label="Dokümantasyon başlangıcı">
          <span className="docs-wordmark__glyph"><Orbit size={17} /></span>
          <span><b>ALPHA LUNAR</b><small>MISSION HANDBOOK / TR</small></span>
        </a>
        <div className="docs-release"><i /> PHASE 02 · NASA SURFACE ATLAS</div>
        <button className="docs-close" onClick={onClose}><X size={17} /><span>ATLASA DÖN</span></button>
      </header>

      <aside className="docs-nav">
        <div className="docs-nav__label">İÇİNDEKİLER</div>
        <a href="#overview"><span>01</span> Genel durum</a>
        <a href="#delivered"><span>02</span> Geliştirilenler</a>
        <a href="#roadmap"><span>03</span> 7 faz yol haritası</a>
        <a href="#operations"><span>04</span> Kullanım kılavuzu</a>
        <a href="#architecture"><span>05</span> Sistem mimarisi</a>
        <a href="#nasa-role"><span>06</span> NASA / Artemis rolü</a>
        <a href="#integrity"><span>07</span> Bilimsel sınırlar</a>
        <a href="#glossary"><span>08</span> Terimler ve kaynaklar</a>
        <div className="docs-nav__status">
          <small>SÜRÜM DURUMU</small><strong><i /> YAYINDA</strong><span>12 KASIM 2026</span>
        </div>
      </aside>

      <main className="docs-main">
        <section className="docs-hero" id="overview">
          <div className="docs-kicker"><span>PROGRAM RAPORU</span><i /> SÜRÜM 2.0</div>
          <h1>Ay görev kararları için<br/><em>görsel bir dijital ikiz temeli.</em></h1>
          <p>ALPHA LUNAR; Ay yüzeyini, kaynak verisini ve ileride eklenecek görev analizlerini tek bir izlenebilir çalışma alanında birleştiren web tabanlı bir görev istihbaratı platformudur.</p>
          <div className="docs-hero__actions">
            <button onClick={() => goExplore('global')}><Orbit size={15} /> KÜRESEL AY’I AÇ</button>
            <button onClick={() => goExplore('south-pole')}><Map size={15} /> GÜNEY KUTBU’NU AÇ</button>
          </div>
          <div className="docs-metrics">
            <div><strong>7</strong><span>TOPLAM FAZ</span></div>
            <div><strong>02</strong><span>AKTİF FAZ</span></div>
            <div><strong>8K</strong><span>LROC GÖRSELİ</span></div>
            <div><strong>40 m</strong><span>KUTUP DEM KAYNAĞI</span></div>
          </div>
        </section>

        <section className="docs-section docs-status-brief">
          <div className="docs-section__index">01 / PROGRAM DURUMU</div>
          <div className="docs-section__heading">
            <div><h2>Bugün nerede?</h2><p>Temel deneyim hazır; bilimsel karar motorları bilinçli olarak henüz etkin değil.</p></div>
            <span className="docs-state active"><i /> GELİŞTİRME AKTİF</span>
          </div>
          <div className="docs-status-grid">
            <article className="complete"><span><Check size={17}/></span><small>PHASE 01</small><h3>Tamamlandı</h3><p>3B Ay, etkileşim, tasarım sistemi, konum dizini ve Güney Kutbu keşif deneyimi üretim ortamında çalışıyor.</p></article>
            <article className="active"><span><Database size={17}/></span><small>PHASE 02</small><h3>Veri çekirdeği hazır</h3><p>NASA LROC ve LOLA verileri işlendi; kaynak izleri, yerel türevler ve gerçek yükselti görselleştirmesi eklendi.</p></article>
            <article><span><CircleDashed size={17}/></span><small>PHASE 03–07</small><h3>Planlandı</h3><p>Aydınlatma, bilimsel katmanlar, görev optimizasyonu, simülasyon ve raporlama sıralı olarak geliştirilecek.</p></article>
          </div>
          <div className="docs-callout"><ShieldCheck size={18}/><p><strong>Önemli ayrım:</strong> Uygulamadaki ayarlanabilir ışık yüzeyi incelemek içindir; tarih/saat tabanlı Güneş simülasyonu değildir. Sistem bugün iniş güvenliği veya görev uygunluğu kararı üretmez.</p></div>
        </section>

        <section className="docs-section" id="delivered">
          <div className="docs-section__index">02 / TESLİM EDİLEN YETENEKLER</div>
          <div className="docs-section__heading"><div><h2>Şu ana kadar geliştirilenler</h2><p>Phase 1 ve Phase 2 veri atlası kilometre taşının çalışır kapsamı.</p></div></div>
          <div className="docs-capabilities">
            <article><span>01</span><Orbit/><h3>Etkileşimli 3B Ay</h3><p>Sürükleyerek yörünge, yakınlaştırma, koordinat seçimi ve akıcı kamera geçişleriyle gerçek zamanlı küresel keşif.</p></article>
            <article><span>02</span><Layers3/><h3>NASA yüzey katmanları</h3><p>LROC renk mozaiği, LOLA yüzey rölyefi ve −10/+12 km yükselti renk haritası arasında anlık geçiş.</p></article>
            <article><span>03</span><Map/><h3>Güney Kutbu komutası</h3><p>85°G–90°G bölgesinde gerçek topografyaya dayalı 3B arazi, 1×/2×/3× düşey ölçek ve landmark seçimi.</p></article>
            <article><span>04</span><Search/><h3>Coğrafi konum dizini</h3><p>IAU/USGS adları, koordinatları, sınıfları ve Gazetteer kayıtlarına doğrudan kaynak bağlantıları.</p></article>
            <article><span>05</span><Database/><h3>İzlenebilir veri hattı</h3><p>Kaynak etiketleri, yeniden örnekleme bilgileri ve checksum manifestosuyla türetilmiş varlıkların doğrulanması.</p></article>
            <article><span>06</span><Sparkles/><h3>Görev arayüz sistemi</h3><p>Panel mimarisi, durum telemetrisi, tam ekran, mobil uyum ve performans odaklı koyu havacılık görsel dili.</p></article>
          </div>
        </section>

        <section className="docs-section" id="roadmap">
          <div className="docs-section__index">03 / ANA GELİŞTİRME PLANI</div>
          <div className="docs-section__heading"><div><h2>7 fazlık yol haritası</h2><p>Her faz, bir sonraki bilimsel ve operasyonel katman için doğrulanabilir temel oluşturur.</p></div><span className="docs-counter">01 → 07</span></div>
          <div className="docs-phases">
            {phases.map((phase) => (
              <article className={`docs-phase ${phase.status}`} key={phase.no}>
                <div className="docs-phase__number">{phase.no}</div>
                <div className="docs-phase__body">
                  <div className="docs-phase__title"><span>{phase.label}</span><h3>{phase.title}</h3></div>
                  <p>{phase.summary}</p>
                  <div className="docs-phase__items">{phase.items.map(item => <span key={item}><Check size={11}/>{item}</span>)}</div>
                  {phase.next && <small>{phase.next}</small>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="docs-section" id="operations">
          <div className="docs-section__index">04 / OPERASYON KILAVUZU</div>
          <div className="docs-section__heading"><div><h2>Program nasıl kullanılır?</h2><p>Mevcut atlas deneyimi için hızlı görev akışı.</p></div></div>
          <div className="docs-workflow">
            <article><b>1</b><span><strong>Görünümü seç</strong><p>Alt merkezdeki GLOBAL / SOUTH POLE anahtarıyla küresel atlas veya bölgesel arazi moduna geç.</p></span></article>
            <article><b>2</b><span><strong>Yüzeyi gez</strong><p>Fareyle sürükleyerek kamerayı döndür; tekerlekle yakınlaş; yüzeye tıklayarak koordinatı seç.</p></span></article>
            <article><b>3</b><span><strong>Katmanı değiştir</strong><p>Sağdaki araçlardan gerçekçi yüzey, gelişmiş rölyef veya LOLA yükselti renklerini aç.</p></span></article>
            <article><b>4</b><span><strong>Konum bul</strong><p>Üstteki arama düğmesiyle krater ve bölgeleri ara. Bir etikete tıklayarak kamera hedefini değiştir.</p></span></article>
            <article><b>5</b><span><strong>Araziyi incele</strong><p>Inspection Light ile ışık açısını ayarla. Güney Kutbu’nda düşey ölçeği 1×–3× seç.</p></span></article>
            <article><b>6</b><span><strong>Kaynağı doğrula</strong><p>Database düğmesinden veri durumunu, PDS ürün etiketini, kaynak sayfasını ve checksum manifestosunu aç.</p></span></article>
          </div>
          <div className="docs-controls-table">
            <div className="head"><span>KONTROL</span><span>İŞLEV</span><span>NOT</span></div>
            <div><span>Sürükle / kaydır</span><span>Kamera yörüngesi ve yakınlaştırma</span><span>Dokunmatik hareketler desteklenir</span></div>
            <div><span>Yüzeye tıkla</span><span>Enlem / boylam seçimi</span><span>IAU pozitif-doğu koordinatları</span></div>
            <div><span>Yüzey / Rölyef / Yükselti</span><span>Görselleştirme katmanı</span><span>Rölyef yalnızca küresel görünümde</span></div>
            <div><span>Etiket / Izgara</span><span>Konumsal referansları aç/kapat</span><span>Izgara yalnızca küresel görünümde</span></div>
            <div><span>Yörünge simgesi</span><span>Kamerayı başlangıca döndür</span><span>Seçili veri değişmez</span></div>
            <div><span>Tam ekran</span><span>Görev konsolunu genişlet</span><span>ESC ile çıkılır</span></div>
          </div>
        </section>

        <section className="docs-section" id="architecture">
          <div className="docs-section__index">05 / TEKNİK MİMARİ</div>
          <div className="docs-section__heading"><div><h2>Ölçeklenebilir veri mimarisi</h2><p>Kaynak veriden karar ürününe kadar katmanlı ve değiştirilebilir yapı.</p></div></div>
          <div className="docs-pipeline" aria-label="Veri işleme mimarisi">
            <div><small>01 · KAYNAK</small><strong>NASA / PDS / USGS</strong><span>LROC · LOLA · Gazetteer</span></div><ChevronRight/>
            <div><small>02 · INGEST</small><strong>Doğrulama hattı</strong><span>Decode · project · checksum</span></div><ChevronRight/>
            <div><small>03 · ATLAS</small><strong>Web türevleri</strong><span>Texture · DEM · metadata</span></div><ChevronRight/>
            <div><small>04 · DİJİTAL İKİZ</small><strong>React + Three.js</strong><span>Scenes · camera · layers</span></div><ChevronRight/>
            <div><small>05 · GELECEK</small><strong>Analiz servisleri</strong><span>SPICE · risk · reports</span></div>
          </div>
          <div className="docs-architecture-grid">
            <article><small>SUNUM KATMANI</small><h3>React + TypeScript</h3><p>Modüler paneller, durum yönetimi, erişilebilir kontroller ve responsive görev konsolu.</p></article>
            <article><small>3B MOTOR</small><h3>Three.js / R3F</h3><p>Küresel ve kutupsal sahneler, GPU dokuları, kamera kontrolü, seçim ve yüzey stilleri.</p></article>
            <article><small>BİLİMSEL VERİ</small><h3>Bağımsız servis sınırı</h3><p>Varlık kataloğu ve domain tipleri, görsel bileşenleri belirli bir veri sağlayıcısına kilitlemez.</p></article>
            <article><small>KALİTE</small><h3>Test + provenance</h3><p>Koordinat dönüşümü, polar projeksiyon, raster örnekleme ve dosya bütünlüğü otomatik test edilir.</p></article>
          </div>
        </section>

        <section className="docs-section docs-nasa" id="nasa-role">
          <div className="docs-section__index">06 / NASA & ARTEMIS BAĞLAMI</div>
          <div className="docs-section__heading"><div><h2>NASA projesinde nasıl yer alabilir?</h2><p>ALPHA LUNAR’ın hedefi, resmî sistemlerin yerine geçmek değil; güvenilir veriyi karar veren insan için anlaşılır ve karşılaştırılabilir hâle getirmektir.</p></div></div>
          <div className="docs-role-flow">
            <span><Database/>KAYNAK VERİ</span><ArrowRight/><span><Layers3/>DİJİTAL İKİZ</span><ArrowRight/><span><Sun/>ANALİZ</span><ArrowRight/><span><Rocket/>SENARYO</span><ArrowRight/><span><FileCheck2/>KARAR RAPORU</span>
          </div>
          <div className="docs-nasa-grid">
            <article><span>01</span><h3>Ön keşif ve brifing</h3><p>Aday bölgeleri tek bir 3B bağlamda incelemek; topoğrafya, adlandırma ve kaynak kanıtını aynı ekranda sunmak.</p></article>
            <article><span>02</span><h3>Bilimsel veri birleştirme</h3><p>LRO/PDS ürünlerini ileride termal, aydınlatma, iletişim ve kaynak katmanlarıyla ortak koordinat sisteminde buluşturmak.</p></article>
            <article><span>03</span><h3>Senaryo karşılaştırması</h3><p>Görev ve araç kısıtları eklendiğinde alternatif iniş bölgelerini tutarlı ölçütler ve açık belirsizliklerle karşılaştırmak.</p></article>
            <article><span>04</span><h3>Eğitim ve paydaş iletişimi</h3><p>Karmaşık kutup geometrisini araştırmacı, mühendis, yönetici ve kamu için aynı görsel dilde açıklamak.</p></article>
          </div>
          <div className="docs-official-note"><ShieldCheck/><div><strong>Bağımsız araştırma ve görselleştirme platformu</strong><p>ALPHA LUNAR şu anda NASA tarafından onaylanmış, uçuşa uygun, emniyet-kritik veya operasyonel bir sistem değildir. Bir NASA iş akışına alınması; veri doğrulama, model V&V, siber güvenlik, erişilebilirlik, yapılandırma yönetimi ve yetkili teknik incelemeler gerektirir.</p></div></div>
        </section>

        <section className="docs-section" id="integrity">
          <div className="docs-section__index">07 / BİLİMSEL BÜTÜNLÜK</div>
          <div className="docs-section__heading"><div><h2>Ne gerçek, ne henüz değil?</h2><p>Görselleştirme ile bilimsel çıkarım arasındaki sınır açık tutulur.</p></div></div>
          <div className="docs-truth-table">
            <div className="head"><span>ÖĞE</span><span>BUGÜNKÜ DURUM</span><span>DOĞRU YORUM</span></div>
            <div><span>LROC renk yüzeyi</span><span className="ready">ENTEGRE</span><span>NASA SVS görselleştirme mozaiği; kutuplarda infill içerir.</span></div>
            <div><span>LOLA yükselti</span><span className="ready">ENTEGRE</span><span>Ölçümlerden ızgaralanmış/interpole edilmiş topografya; web türevleri yeniden örneklenmiştir.</span></div>
            <div><span>Güney Kutbu arazi</span><span className="ready">ENTEGRE</span><span>40 m kaynak üründen 160 m raster ve yaklaşık 474 m mesh aralığıyla tarayıcıya uyarlanır.</span></div>
            <div><span>Inspection Light</span><span className="visual">GÖRSEL</span><span>Yüzey biçimini okumaya yardım eder; astronomik tarih/saat hesabı değildir.</span></div>
            <div><span>İniş güvenliği</span><span className="inactive">ETKİN DEĞİL</span><span>Eğim/pürüzlülük eşikleri ve görev kısıtları eklenmeden karar üretmez.</span></div>
            <div><span>Su buzu / termal / iletişim</span><span className="inactive">PLANLANDI</span><span>Kaynak ürün ve belirsizlik modeli doğrulandıktan sonra ayrı katmanlar olarak eklenecek.</span></div>
          </div>
        </section>

        <section className="docs-section" id="glossary">
          <div className="docs-section__index">08 / TERİMLER & KAYNAKLAR</div>
          <div className="docs-section__heading"><div><h2>Teknik sözlük</h2><p>Platformda sık kullanılan kavramların kısa açıklaması.</p></div></div>
          <div className="docs-glossary">{glossary.map(([term, meaning]) => <div key={term}><strong>{term}</strong><p>{meaning}</p></div>)}</div>
          <div className="docs-sources">
            <h3>Resmî kaynak kapıları</h3>
            <a href="https://science.nasa.gov/mission/lro/" target="_blank" rel="noreferrer"><span>NASA Science</span><strong>Lunar Reconnaissance Orbiter</strong><ExternalLink/></a>
            <a href="https://science.nasa.gov/mission/lro/spacecraft-and-instruments/" target="_blank" rel="noreferrer"><span>NASA Science</span><strong>LROC & LOLA araçları</strong><ExternalLink/></a>
            <a href="https://www.nasa.gov/architecture/" target="_blank" rel="noreferrer"><span>NASA</span><strong>Moon to Mars Architecture</strong><ExternalLink/></a>
            <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noreferrer"><span>IAU / USGS</span><strong>Planetary Nomenclature</strong><ExternalLink/></a>
            <a href="https://pds-geosciences.wustl.edu/missions/lro/lola.htm" target="_blank" rel="noreferrer"><span>NASA PDS</span><strong>LOLA veri arşivi</strong><ExternalLink/></a>
          </div>
        </section>

        <footer className="docs-footer">
          <div><BookOpen/><span><strong>ALPHA LUNAR</strong><small>Advanced Lunar Digital Twin & Mission Intelligence</small></span></div>
          <p>Doküman sürümü 2.0 · 12 Kasım 2026<br/>Phase 2 / NASA Surface Atlas</p>
          <button onClick={() => goExplore('global')}>ATLASA DÖN <ArrowRight size={14}/></button>
        </footer>
      </main>
    </div>
  )
}
