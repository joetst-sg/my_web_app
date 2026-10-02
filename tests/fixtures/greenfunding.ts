// Synthetic pages that mirror the structure of GREEN FUNDING's public pages
// (no real campaign content).

export const listingHtml = `
<html><body>
<a href="/portals/search?category_id=27"><div><span>#</span><div>ガジェット</div></div></a>
<div class="project-list">
  <a href="/lab/projects/1001">Campaign A</a>
  <a href="/lab/projects/1001">Campaign A again</a>
  <a href="https://greenfunding.jp/partner_x/projects/1002">Campaign B</a>
  <a href="/lab/projects/1003/activities/55">Activity report (not a campaign)</a>
  <a href="/lab/projects/1004?ref=top">Campaign D</a>
  <a href="https://evil.example.com/lab/projects/9999">Elsewhere</a>
</div>
<a href="/portals/search?condition=new&amp;page=2">2</a>
</body></html>`

export const campaignHtml = (opts: { daysLeft?: string; ribbon?: string; extra?: string } = {}) => `
<html><head>
<meta content='テスト　ワイヤレス　ヘッドホン X100' property='og:title'>
<meta content='ノイズキャンセリング搭載。最大40時間再生。' property='og:description'>
<meta content='https://images.greenfunding.jp/store/hero123' property='og:image'>
<script type="application/ld+json">[{"@type":"WebSite","name":"x"},{"@context":"http://schema.org","@type":"Product","name":"テスト ワイヤレス
ヘッドホン X100","image":"https://images.greenfunding.jp/store/hero123","url":"https://greenfunding.jp/lab/projects/1001",
"offers":[{"@type":"Offer","priceCurrency":"JPY","price":"19800"},{"@type":"Offer","priceCurrency":"JPY","price":"15800"}]}]</script>
</head><body>
<div class='project_header'>
  <h1>テスト ワイヤレス ヘッドホン X100</h1>
  <a href="/portals/search?category_id=27"><span>#</span>ガジェット</a>
  <a href="/portals/search?category_id=45"><span>#</span>オーディオ</a>
</div>
<div class='project-content'>
  <div class='project-main_visual'><img src="https://images.greenfunding.jp/store/hero123" /><iframe src='https://www.youtube.com/embed/abcDEF12345'></iframe></div>
  <ul class='project-social_button'><li>Tweet</li></ul>
  <p><img src="https://images.greenfunding.jp/store/img2" /></p>
  <h1><strong>■特徴</strong></h1>
  <p><strong>最大40時間</strong>の連続再生。<br />Bluetooth 5.3対応。</p>
  <ul><li>重量：250g</li><li>型番：X100</li></ul>
  <p>&nbsp;</p>
  <script>alert('x')</script>
  ${opts.extra ?? ''}
</div>
<div class='l-sidebar is-right'>
<div class='project_sidebar'>
  <div class='project_sidebar_dashboard'>
    ${opts.ribbon ?? ''}
    <div class='project_sidebar_dashboard-target-info'><div class='text'><span>目標</span><span class='is-number'>¥ 300,000</span></div></div>
    <div class='project_sidebar_dashboard-amount'><span>¥</span> 1,234,567 </div>
    <div class='project_sidebar_dashboard-info'><ul><li><div>残り時間</div><div><span class="is-number">${opts.daysLeft ?? '12'}</span>日</div></li><li><div>支援人数</div><div><span>321</span>人</div></li></ul></div>
  </div>
  <div class='project_sidebar_profile-name'> Test Audio Inc. <svg></svg></div>
</div></div>
</body></html>`
