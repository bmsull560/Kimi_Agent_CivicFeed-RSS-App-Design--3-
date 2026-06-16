import fs from 'fs';

const filePath = 'src/data/feeds.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find the closing of the feeds array
const feedsEndMarker = `  {id:"feed-623",name:"Voice of America",shortName:"Voice of America",agency:"Voice of America",description:"Voice of America",rssUrl:"https://www.voanews.com/rssfeeds",website:"https://www.insidevoa.com/rssfeeds",department:"",category:"Diplomacy & Foreign Affairs",subCategory:"Diplomacy & Foreign Affairs",contentType:"Voice of America",updateFrequency:"",status:"unverified" as const,tags:["diplomacy & foreign affairs"]},
];`;

const newFeeds = `
  // --- TIER 1: CRITICAL SAFETY, HEALTH & EMERGENCY ---
  {id:"feed-624",name:"CISA Cyber Alerts",shortName:"CISA Alerts",agency:"CISA",description:"Critical cybersecurity alerts and vulnerabilities.",rssUrl:"https://www.cisa.gov/uscert/ncas/alerts.xml",website:"https://www.cisa.gov",department:"DHS",category:"Defense & Security",subCategory:"Cybersecurity",contentType:"Cybersecurity alerts",updateFrequency:"",status:"working" as const,priority:1,tags:["cybersecurity","alerts","cisa"]},
  {id:"feed-625",name:"CISA Current Activity",shortName:"CISA Activity",agency:"CISA",description:"Current cybersecurity activity and threat updates.",rssUrl:"https://www.cisa.gov/uscert/ncas/current-activity.xml",website:"https://www.cisa.gov",department:"DHS",category:"Defense & Security",subCategory:"Cybersecurity",contentType:"Threat updates",updateFrequency:"",status:"working" as const,priority:1,tags:["cybersecurity","cisa","threats"]},
  {id:"feed-626",name:"CISA Analysis Reports",shortName:"CISA Analysis",agency:"CISA",description:"In-depth cybersecurity analysis reports.",rssUrl:"https://www.cisa.gov/uscert/ncas/analysis-reports.xml",website:"https://www.cisa.gov",department:"DHS",category:"Defense & Security",subCategory:"Cybersecurity",contentType:"Analysis reports",updateFrequency:"",status:"working" as const,priority:1,tags:["cybersecurity","cisa","analysis"]},
  {id:"feed-627",name:"CISA Bulletins",shortName:"CISA Bulletins",agency:"CISA",description:"Weekly cybersecurity bulletins.",rssUrl:"https://www.cisa.gov/uscert/ncas/bulletins.xml",website:"https://www.cisa.gov",department:"DHS",category:"Defense & Security",subCategory:"Cybersecurity",contentType:"Bulletins",updateFrequency:"",status:"working" as const,priority:1,tags:["cybersecurity","cisa","bulletins"]},
  {id:"feed-628",name:"CDC Travel Health Notices",shortName:"CDC Travel Health",agency:"CDC",description:"Travel health notices and disease outbreak alerts.",rssUrl:"https://wwwnc.cdc.gov/travel/rss/notices.xml",website:"https://wwwnc.cdc.gov",department:"HHS",category:"Health & Science",subCategory:"Travel Health",contentType:"Travel health notices",updateFrequency:"",status:"working" as const,priority:1,tags:["health","travel","cdc","outbreak"]},
  {id:"feed-629",name:"CDC Food Safety Recall Aggregator",shortName:"CDC Food Recalls",agency:"CDC",description:"Aggregated food safety recalls from FDA and USDA.",rssUrl:"http://www2c.cdc.gov/podcasts/createrss.asp?c=146",website:"https://www.cdc.gov",department:"HHS",category:"Health & Science",subCategory:"Food Safety",contentType:"Food recalls",updateFrequency:"",status:"working" as const,priority:1,tags:["health","food","recalls","cdc"]},
  {id:"feed-630",name:"CDC MMWR",shortName:"CDC MMWR",agency:"CDC",description:"Morbidity and Mortality Weekly Report surveillance data.",rssUrl:"https://www.cdc.gov/mmwr/rss/mmwr_qrps.xml",website:"https://www.cdc.gov",department:"HHS",category:"Health & Science",subCategory:"Surveillance",contentType:"Public health surveillance",updateFrequency:"",status:"working" as const,priority:1,tags:["health","surveillance","cdc","mmwr"]},
  {id:"feed-631",name:"FDA Food Safety Recalls",shortName:"FDA Food Recalls",agency:"FDA",description:"Food safety recall announcements.",rssUrl:"https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/food-safety-recalls/rss.xml",website:"https://www.fda.gov",department:"HHS",category:"Health & Science",subCategory:"Food Safety",contentType:"Food recalls",updateFrequency:"",status:"working" as const,priority:1,tags:["health","food","recalls","fda"]},
  {id:"feed-632",name:"FDA Outbreak Investigations",shortName:"FDA Outbreaks",agency:"FDA",description:"Foodborne illness outbreak investigations.",rssUrl:"https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/fda-outbreaks/rss.xml",website:"https://www.fda.gov",department:"HHS",category:"Health & Science",subCategory:"Outbreaks",contentType:"Outbreak investigations",updateFrequency:"",status:"working" as const,priority:1,tags:["health","outbreak","fda","foodborne"]},
  {id:"feed-633",name:"FDA All Recalls",shortName:"FDA All Recalls",agency:"FDA",description:"All FDA recalls: drugs, devices, food.",rssUrl:"https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml",website:"https://www.fda.gov",department:"HHS",category:"Health & Science",subCategory:"Recalls",contentType:"All recalls",updateFrequency:"",status:"working" as const,priority:1,tags:["health","recalls","fda","drugs","devices"]},
  {id:"feed-634",name:"FDA MedWatch Safety Alerts",shortName:"FDA MedWatch",agency:"FDA",description:"MedWatch safety alerts for human medical products.",rssUrl:"https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml",website:"https://www.fda.gov",department:"HHS",category:"Health & Science",subCategory:"Drug Safety",contentType:"Safety alerts",updateFrequency:"",status:"working" as const,priority:1,tags:["health","drug-safety","fda","medwatch"]},
  {id:"feed-635",name:"FEMA All Disaster Declarations",shortName:"FEMA Disasters",agency:"FEMA",description:"All federal disaster declarations.",rssUrl:"https://www.fema.gov/feeds/disasters.rss",website:"https://www.fema.gov",department:"DHS",category:"Safety & Consumer Protection",subCategory:"Disasters",contentType:"Disaster declarations",updateFrequency:"",status:"working" as const,priority:1,tags:["emergency","disaster","fema","declarations"]},
  {id:"feed-636",name:"FEMA Major Disaster Declarations",shortName:"FEMA Major Disasters",agency:"FEMA",description:"Major federal disaster declarations.",rssUrl:"https://www.fema.gov/feeds/disasters-major.rss",website:"https://www.fema.gov",department:"DHS",category:"Safety & Consumer Protection",subCategory:"Disasters",contentType:"Major disaster declarations",updateFrequency:"",status:"working" as const,priority:1,tags:["emergency","disaster","fema","major"]},
  {id:"feed-637",name:"FEMA Emergency Declarations",shortName:"FEMA Emergency",agency:"FEMA",description:"Federal emergency declarations.",rssUrl:"https://www.fema.gov/feeds/disasters-emergency.rss",website:"https://www.fema.gov",department:"DHS",category:"Safety & Consumer Protection",subCategory:"Disasters",contentType:"Emergency declarations",updateFrequency:"",status:"working" as const,priority:1,tags:["emergency","fema","declarations"]},
  {id:"feed-638",name:"FEMA Fire Management Assistance",shortName:"FEMA Fire Mgmt",agency:"FEMA",description:"Fire management assistance declarations.",rssUrl:"https://www.fema.gov/feeds/disasters-fire.rss",website:"https://www.fema.gov",department:"DHS",category:"Safety & Consumer Protection",subCategory:"Fire",contentType:"Fire management assistance",updateFrequency:"",status:"working" as const,priority:1,tags:["emergency","fire","fema"]},
  {id:"feed-639",name:"NOAA Weather Alerts (CAP)",shortName:"NOAA Alerts",agency:"NOAA",description:"Nationwide weather alerts in CAP format.",rssUrl:"https://alerts.weather.gov/cap/us.php?x=0",website:"https://alerts.weather.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"Weather alerts",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","alerts","noaa","emergency"]},
  {id:"feed-640",name:"NOAA Storm Prediction Center",shortName:"NOAA SPC",agency:"NOAA",description:"Storm prediction center forecasts and outlooks.",rssUrl:"https://www.spc.noaa.gov/products/spcrss.xml",website:"https://www.spc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"Storm predictions",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","storms","noaa","spc"]},
  {id:"feed-641",name:"NOAA Severe Weather Watches",shortName:"NOAA Watches",agency:"NOAA",description:"Tornado and severe thunderstorm watches.",rssUrl:"https://www.spc.noaa.gov/products/spcwwrss.xml",website:"https://www.spc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"Severe weather watches",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","severe","tornado","noaa"]},
  {id:"feed-642",name:"NOAA PDS Watches",shortName:"NOAA PDS",agency:"NOAA",description:"Particularly Dangerous Situation watches.",rssUrl:"https://www.spc.noaa.gov/products/spcpdswwrss.xml",website:"https://www.spc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"PDS watches",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","severe","pds","noaa"]},
  {id:"feed-643",name:"NOAA Mesoscale Discussions",shortName:"NOAA Meso",agency:"NOAA",description:"Mesoscale discussions from SPC.",rssUrl:"https://www.spc.noaa.gov/products/spcmdrss.xml",website:"https://www.spc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"Mesoscale discussions",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","mesoscale","noaa","spc"]},
  {id:"feed-644",name:"NOAA Convective Outlooks",shortName:"NOAA Outlooks",agency:"NOAA",description:"Convective outlook forecasts.",rssUrl:"https://www.spc.noaa.gov/products/spcacrss.xml",website:"https://www.spc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"Convective outlooks",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","convective","noaa","outlooks"]},
  {id:"feed-645",name:"NOAA Fire Weather",shortName:"NOAA Fire Weather",agency:"NOAA",description:"Fire weather outlooks.",rssUrl:"https://www.spc.noaa.gov/products/spcfwrss.xml",website:"https://www.spc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"Fire weather outlooks",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","fire","noaa"]},
  {id:"feed-646",name:"NOAA SPC Multimedia Briefings",shortName:"NOAA Briefings",agency:"NOAA",description:"Multimedia briefings from SPC.",rssUrl:"https://www.spc.noaa.gov/products/spcmbrss.xml",website:"https://www.spc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Weather",contentType:"Multimedia briefings",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","briefings","noaa","spc"]},
  {id:"feed-647",name:"NHC Atlantic Tropical Cyclones",shortName:"NHC Atlantic",agency:"NOAA",description:"Atlantic hurricane and tropical cyclone updates.",rssUrl:"https://www.nhc.noaa.gov/index-at.xml",website:"https://www.nhc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Hurricanes",contentType:"Tropical cyclone updates",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","hurricane","atlantic","noaa","nhc"]},
  {id:"feed-648",name:"NHC Eastern Pacific",shortName:"NHC E Pacific",agency:"NOAA",description:"Eastern Pacific hurricane updates.",rssUrl:"https://www.nhc.noaa.gov/index-ep.xml",website:"https://www.nhc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Hurricanes",contentType:"Hurricane updates",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","hurricane","pacific","noaa","nhc"]},
  {id:"feed-649",name:"NHC Central Pacific",shortName:"NHC C Pacific",agency:"NOAA",description:"Central Pacific hurricane updates.",rssUrl:"https://www.nhc.noaa.gov/index-cp.xml",website:"https://www.nhc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Hurricanes",contentType:"Hurricane updates",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","hurricane","pacific","noaa","nhc"]},
  {id:"feed-650",name:"NHC Tropical Weather Outlook",shortName:"NHC Outlook",agency:"NOAA",description:"Tropical weather outlook for Atlantic and Pacific.",rssUrl:"https://www.nhc.noaa.gov/gtwo.xml",website:"https://www.nhc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Hurricanes",contentType:"Tropical outlook",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","hurricane","outlook","noaa","nhc"]},
  {id:"feed-651",name:"NHC Atlantic GIS Data",shortName:"NHC GIS",agency:"NOAA",description:"GIS data for Atlantic tropical cyclones.",rssUrl:"https://www.nhc.noaa.gov/gis-at.xml",website:"https://www.nhc.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Hurricanes",contentType:"GIS data",updateFrequency:"",status:"working" as const,priority:1,tags:["weather","hurricane","gis","noaa","nhc"]},
  {id:"feed-652",name:"Pacific Tsunami Warnings",shortName:"PTWC Warnings",agency:"NOAA",description:"Pacific tsunami warning alerts.",rssUrl:"https://weather.gov/ptwc/feeds/ptwc_rss_pacific.xml",website:"https://weather.gov/ptwc",department:"Commerce",category:"Environment & Energy",subCategory:"Tsunami",contentType:"Tsunami warnings",updateFrequency:"",status:"working" as const,priority:1,tags:["tsunami","warning","noaa","pacific"]},
  {id:"feed-653",name:"USGS Significant Earthquakes (Weekly)",shortName:"USGS Earthquakes",agency:"USGS",description:"Significant earthquakes worldwide (weekly).",rssUrl:"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom",website:"https://earthquake.usgs.gov",department:"Interior",category:"Environment & Energy",subCategory:"Earthquakes",contentType:"Earthquake data",updateFrequency:"",status:"working" as const,priority:1,tags:["earthquake","usgs","geology"]},
  {id:"feed-654",name:"USGS All Earthquakes (Hourly)",shortName:"USGS All Quakes",agency:"USGS",description:"All earthquakes worldwide (hourly feed).",rssUrl:"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",website:"https://earthquake.usgs.gov",department:"Interior",category:"Environment & Energy",subCategory:"Earthquakes",contentType:"Earthquake data",updateFrequency:"",status:"working" as const,priority:1,tags:["earthquake","usgs","hourly"]},
  {id:"feed-655",name:"NOAA NCEI Climate Reports",shortName:"NCEI Climate",agency:"NOAA",description:"Monthly climate reports and assessments.",rssUrl:"https://www.ncei.noaa.gov/access/monitoring/dyk/sotc-rss",website:"https://www.ncei.noaa.gov",department:"Commerce",category:"Environment & Energy",subCategory:"Climate",contentType:"Climate reports",updateFrequency:"",status:"working" as const,priority:1,tags:["climate","noaa","ncei"]},

  // --- TIER 2: FINANCIAL, CONSUMER & INVESTOR PROTECTION ---
  {id:"feed-656",name:"SEC Enforcement Press Releases",shortName:"SEC Press",agency:"SEC",description:"SEC enforcement actions and press releases.",rssUrl:"https://www.sec.gov/news/pressreleases.rss",website:"https://www.sec.gov",department:"",category:"Finance & Economy",subCategory:"Enforcement",contentType:"Press releases",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","sec","enforcement","investor"]},
  {id:"feed-657",name:"SEC News Digest",shortName:"SEC Digest",agency:"SEC",description:"Daily SEC news digest.",rssUrl:"https://www.sec.gov/rss/news/digest.shtml",website:"https://www.sec.gov",department:"",category:"Finance & Economy",subCategory:"News",contentType:"News digest",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","sec","news"]},
  {id:"feed-658",name:"CFTC Enforcement Actions",shortName:"CFTC Enforcement",agency:"CFTC",description:"CFTC enforcement actions.",rssUrl:"https://www.cftc.gov/RSS/RSSENF/rssenf.xml",website:"https://www.cftc.gov",department:"",category:"Finance & Economy",subCategory:"Enforcement",contentType:"Enforcement actions",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","cftc","enforcement","commodities"]},
  {id:"feed-659",name:"Federal Reserve All Press Releases",shortName:"Fed Press",agency:"Federal Reserve",description:"All Federal Reserve press releases.",rssUrl:"https://www.federalreserve.gov/feeds/press_all.xml",website:"https://www.federalreserve.gov",department:"",category:"Finance & Economy",subCategory:"Monetary Policy",contentType:"Press releases",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","fed","monetary-policy"]},
  {id:"feed-660",name:"Treasury Daily Yield Curve",shortName:"Treasury Yield",agency:"Treasury",description:"Daily Treasury yield curve rates.",rssUrl:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=all",website:"https://home.treasury.gov",department:"Treasury",category:"Finance & Economy",subCategory:"Interest Rates",contentType:"Yield curve data",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","treasury","yield","rates"]},
  {id:"feed-661",name:"Treasury Daily Bill Rates",shortName:"Treasury Bills",agency:"Treasury",description:"Daily Treasury bill rates.",rssUrl:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_bill_rates&field_tdr_date_value=all",website:"https://home.treasury.gov",department:"Treasury",category:"Finance & Economy",subCategory:"Interest Rates",contentType:"Bill rates",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","treasury","bills","rates"]},
  {id:"feed-662",name:"Treasury Daily Long-Term Rates",shortName:"Treasury Long-Term",agency:"Treasury",description:"Daily long-term Treasury rates.",rssUrl:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_long_term_rate&field_tdr_date_value=all",website:"https://home.treasury.gov",department:"Treasury",category:"Finance & Economy",subCategory:"Interest Rates",contentType:"Long-term rates",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","treasury","long-term","rates"]},
  {id:"feed-663",name:"Treasury Daily Real Yield Curve",shortName:"Treasury Real Yield",agency:"Treasury",description:"Daily real yield curve rates.",rssUrl:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_real_yield_curve&field_tdr_date_value=all",website:"https://home.treasury.gov",department:"Treasury",category:"Finance & Economy",subCategory:"Interest Rates",contentType:"Real yield curve",updateFrequency:"",status:"working" as const,priority:2,tags:["finance","treasury","real-yield","rates"]},
  {id:"feed-664",name:"FTC Press Releases",shortName:"FTC Press",agency:"FTC",description:"FTC press releases.",rssUrl:"https://www.ftc.gov/feeds/press-release.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Consumer Protection",contentType:"Press releases",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","protection"]},
  {id:"feed-665",name:"FTC Competition Press Releases",shortName:"FTC Competition",agency:"FTC",description:"FTC competition and antitrust press releases.",rssUrl:"https://www.ftc.gov/feeds/press-release-competition.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Antitrust",contentType:"Competition PR",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","competition","antitrust"]},
  {id:"feed-666",name:"FTC Consumer Protection PR",shortName:"FTC Consumer PR",agency:"FTC",description:"FTC consumer protection press releases.",rssUrl:"https://www.ftc.gov/feeds/press-release-consumer-protection.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Consumer Protection",contentType:"Consumer protection PR",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","protection"]},
  {id:"feed-667",name:"FTC HSR Early Termination Notices",shortName:"FTC HSR",agency:"FTC",description:"HSR early termination notices.",rssUrl:"https://www.ftc.gov/feeds/hsr-early-termination-notices.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Mergers",contentType:"HSR notices",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","hsr","mergers"]},
  {id:"feed-668",name:"FTC Consumer Blog",shortName:"FTC Consumer Blog",agency:"FTC",description:"FTC consumer advice blog.",rssUrl:"https://www.consumer.ftc.gov/blog/gd-rss.xml",website:"https://www.consumer.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Consumer Education",contentType:"Blog",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","blog","education"]},
  {id:"feed-669",name:"FTC Business Blog",shortName:"FTC Business Blog",agency:"FTC",description:"FTC business guidance blog.",rssUrl:"https://www.ftc.gov/feeds/blog-business.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Business",contentType:"Blog",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","business","blog"]},
  {id:"feed-670",name:"FTC Competition Matters Blog",shortName:"FTC Comp Blog",agency:"FTC",description:"FTC competition policy blog.",rssUrl:"https://www.ftc.gov/feeds/blog-competition-matters.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Competition",contentType:"Blog",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","competition","blog"]},
  {id:"feed-671",name:"FTC Data Spotlight",shortName:"FTC Data",agency:"FTC",description:"FTC data spotlight reports.",rssUrl:"https://www.ftc.gov/feeds/data-spotlight.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Data",contentType:"Data spotlight",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","data","reports"]},
  {id:"feed-672",name:"FTC OIG Reports",shortName:"FTC OIG",agency:"FTC",description:"FTC Office of Inspector General reports.",rssUrl:"https://www.ftc.gov/feeds/oig-reports-press-releases.xml",website:"https://www.ftc.gov",department:"",category:"Safety & Consumer Protection",subCategory:"Oversight",contentType:"OIG reports",updateFrequency:"",status:"working" as const,priority:2,tags:["consumer","ftc","oig","oversight"]},
  {id:"feed-673",name:"HHS News & Podcasts",shortName:"HHS News",agency:"HHS",description:"HHS news and podcast updates.",rssUrl:"https://www.hhs.gov/rss/podcasts.xml",website:"https://www.hhs.gov",department:"HHS",category:"Health & Science",subCategory:"News",contentType:"News and podcasts",updateFrequency:"",status:"working" as const,priority:2,tags:["health","hhs","news","podcasts"]},

  // --- TIER 3: TRANSPORTATION & TRAVEL SAFETY ---
  {id:"feed-674",name:"State Dept Travel Advisories",shortName:"Travel Advisories",agency:"State Department",description:"Travel advisories and warnings.",rssUrl:"https://travel.state.gov/_res/rss/TAsTWs.xml",website:"https://travel.state.gov",department:"State",category:"Diplomacy & Foreign Affairs",subCategory:"Travel",contentType:"Travel advisories",updateFrequency:"",status:"working" as const,priority:3,tags:["travel","state","advisory","warning"]},
  {id:"feed-675",name:"NTSB Press Releases",shortName:"NTSB Press",agency:"NTSB",description:"NTSB press releases.",rssUrl:"https://www.ntsb.gov/_layouts/feed.aspx?xsl=1&web=%2F&page=674e62a9-4f3b-4058-846b-150bc1c21aa0&wp=5c78a16b-edcb-475c-8a9c-93c00783cd61&pageurl=%2FPages%2FRSS%2DFeed%2DPage%2Daspx",website:"https://www.ntsb.gov",department:"",category:"Transportation",subCategory:"Aviation",contentType:"Press releases",updateFrequency:"",status:"working" as const,priority:3,tags:["transportation","ntsb","aviation","safety"]},
  {id:"feed-676",name:"NTSB Investigation Updates",shortName:"NTSB Investigations",agency:"NTSB",description:"NTSB investigation updates.",rssUrl:"https://www.ntsb.gov/_layouts/feed.aspx?xsl=1&web=%2F&page=674e62a9-4f3b-4058-846b-150bc1c21aa0&wp=a19255e2-c8e3-41fd-8c99-f8bc0453cb58&pageurl=%2FPages%2FRSS%2DFeed%2DPage%2Daspx",website:"https://www.ntsb.gov",department:"",category:"Transportation",subCategory:"Investigations",contentType:"Investigation updates",updateFrequency:"",status:"working" as const,priority:3,tags:["transportation","ntsb","investigation"]},
  {id:"feed-677",name:"CBP Border Wait Times",shortName:"CBP Wait Times",agency:"CBP",description:"Border wait times RSS feed.",rssUrl:"https://bwt.cbp.gov/customRss/New",website:"https://bwt.cbp.gov",department:"DHS",category:"Transportation",subCategory:"Borders",contentType:"Wait times",updateFrequency:"",status:"working" as const,priority:3,tags:["transportation","cbp","border","wait"]},

  // --- TIER 4: ENVIRONMENT, ENERGY & NUCLEAR SAFETY ---
  {id:"feed-678",name:"CSB All News",shortName:"CSB News",agency:"CSB",description:"Chemical Safety Board news.",rssUrl:"https://www.csb.gov/rss/news.aspx",website:"https://www.csb.gov",department:"",category:"Environment & Energy",subCategory:"Chemical Safety",contentType:"News",updateFrequency:"",status:"working" as const,priority:4,tags:["environment","csb","chemical","safety"]},
  {id:"feed-679",name:"CSB Investigations",shortName:"CSB Investigations",agency:"CSB",description:"CSB chemical incident investigations.",rssUrl:"https://www.csb.gov/rss/news.aspx?CategoryId=60",website:"https://www.csb.gov",department:"",category:"Environment & Energy",subCategory:"Investigations",contentType:"Investigations",updateFrequency:"",status:"working" as const,priority:4,tags:["environment","csb","investigation"]},
  {id:"feed-680",name:"CSB Safety Messages",shortName:"CSB Safety",agency:"CSB",description:"CSB safety messages and recommendations.",rssUrl:"https://www.csb.gov/rss/news.aspx?CategoryId=61",website:"https://www.csb.gov",department:"",category:"Environment & Energy",subCategory:"Safety",contentType:"Safety messages",updateFrequency:"",status:"working" as const,priority:4,tags:["environment","csb","safety"]},
  {id:"feed-681",name:"CSB Safety Videos",shortName:"CSB Videos",agency:"CSB",description:"CSB safety videos.",rssUrl:"https://www.csb.gov/rss/news.aspx?CategoryId=62",website:"https://www.csb.gov",department:"",category:"Environment & Energy",subCategory:"Safety",contentType:"Videos",updateFrequency:"",status:"working" as const,priority:4,tags:["environment","csb","videos"]},
  {id:"feed-682",name:"CSB All Events",shortName:"CSB Events",agency:"CSB",description:"CSB public events.",rssUrl:"https://www.csb.gov/rss/events.aspx",website:"https://www.csb.gov",department:"",category:"Environment & Energy",subCategory:"Events",contentType:"Events",updateFrequency:"",status:"working" as const,priority:4,tags:["environment","csb","events"]},
  {id:"feed-683",name:"NRC Daily Event Reports",shortName:"NRC Events",agency:"NRC",description:"Nuclear Regulatory Commission daily event reports.",rssUrl:"https://www.nrc.gov/public-involve/rss?feed=event",website:"https://www.nrc.gov",department:"NRC",category:"Environment & Energy",subCategory:"Nuclear",contentType:"Event reports",updateFrequency:"",status:"working" as const,priority:4,tags:["nuclear","nrc","events","safety"]},
  {id:"feed-684",name:"NRC News Releases",shortName:"NRC News",agency:"NRC",description:"NRC news releases.",rssUrl:"https://www.nrc.gov/public-involve/rss?feed=news",website:"https://www.nrc.gov",department:"NRC",category:"Environment & Energy",subCategory:"Nuclear",contentType:"News releases",updateFrequency:"",status:"working" as const,priority:4,tags:["nuclear","nrc","news"]},
  {id:"feed-685",name:"NRC Power Reactor Status",shortName:"NRC Reactor Status",agency:"NRC",description:"Power reactor status reports.",rssUrl:"https://www.nrc.gov/public-involve/rss?feed=plant-status",website:"https://www.nrc.gov",department:"NRC",category:"Environment & Energy",subCategory:"Nuclear",contentType:"Reactor status",updateFrequency:"",status:"working" as const,priority:4,tags:["nuclear","nrc","reactor","status"]},
  {id:"feed-686",name:"NRC What's New",shortName:"NRC New Content",agency:"NRC",description:"New content on NRC website.",rssUrl:"https://www.nrc.gov/public-involve/rss?feed=new-content",website:"https://www.nrc.gov",department:"NRC",category:"Environment & Energy",subCategory:"Nuclear",contentType:"New content",updateFrequency:"",status:"working" as const,priority:4,tags:["nuclear","nrc","news"]},
  {id:"feed-687",name:"EIA Today in Energy",shortName:"EIA Today",agency:"EIA",description:"Energy Information Administration daily energy updates.",rssUrl:"https://www.eia.gov/rss/todayinenergy.xml",website:"https://www.eia.gov",department:"DOE",category:"Environment & Energy",subCategory:"Energy",contentType:"Energy updates",updateFrequency:"",status:"working" as const,priority:4,tags:["energy","eia","daily"]},
  {id:"feed-688",name:"EIA Press Releases",shortName:"EIA Press",agency:"EIA",description:"EIA press releases.",rssUrl:"https://www.eia.gov/rss/press_rss.xml",website:"https://www.eia.gov",department:"DOE",category:"Environment & Energy",subCategory:"Energy",contentType:"Press releases",updateFrequency:"",status:"working" as const,priority:4,tags:["energy","eia","press"]},
  {id:"feed-689",name:"EIA Gasoline & Diesel Update",shortName:"EIA Gas Diesel",agency:"EIA",description:"Weekly gasoline and diesel price updates.",rssUrl:"https://www.eia.gov/petroleum/gasdiesel/includes/gas_diesel_rss.xml",website:"https://www.eia.gov",department:"DOE",category:"Environment & Energy",subCategory:"Energy",contentType:"Fuel prices",updateFrequency:"",status:"working" as const,priority:4,tags:["energy","eia","gasoline","diesel"]},
  {id:"feed-690",name:"EIA Heating Oil & Propane Update",shortName:"EIA Heating Oil",agency:"EIA",description:"Weekly heating oil and propane updates.",rssUrl:"https://www.eia.gov/petroleum/heatingoilpropane/includes/hopu_rss.xml",website:"https://www.eia.gov",department:"DOE",category:"Environment & Energy",subCategory:"Energy",contentType:"Heating oil prices",updateFrequency:"",status:"working" as const,priority:4,tags:["energy","eia","heating","propane"]},
  {id:"feed-691",name:"EIA Congressional Testimony",shortName:"EIA Testimony",agency:"EIA",description:"EIA congressional testimony.",rssUrl:"https://www.eia.gov/rss/testimony.xml",website:"https://www.eia.gov",department:"DOE",category:"Environment & Energy",subCategory:"Energy",contentType:"Testimony",updateFrequency:"",status:"working" as const,priority:4,tags:["energy","eia","congress","testimony"]},
  {id:"feed-692",name:"EIA Presentations",shortName:"EIA Presentations",agency:"EIA",description:"EIA presentations.",rssUrl:"https://www.eia.gov/rss/presentations.xml",website:"https://www.eia.gov",department:"DOE",category:"Environment & Energy",subCategory:"Energy",contentType:"Presentations",updateFrequency:"",status:"working" as const,priority:4,tags:["energy","eia","presentations"]},

  // --- TIER 5: SECURITY, LAW ENFORCEMENT & INTELLIGENCE ---
  {id:"feed-693",name:"FBI Cyber Crime Alerts",shortName:"FBI Cyber",agency:"FBI",description:"FBI cyber crime alerts and notifications.",rssUrl:"https://www.fbi.gov/investigate/cyber/RSS",website:"https://www.fbi.gov",department:"DOJ",category:"Defense & Security",subCategory:"Cyber Crime",contentType:"Cyber alerts",updateFrequency:"",status:"working" as const,priority:5,tags:["security","fbi","cyber","crime"]},
  {id:"feed-694",name:"DNI Intelligence Community News",shortName:"DNI IC News",agency:"DNI",description:"Director of National Intelligence community news.",rssUrl:"https://www.dni.gov/index.php/rss",website:"https://www.dni.gov",department:"",category:"Defense & Security",subCategory:"Intelligence",contentType:"Intelligence news",updateFrequency:"",status:"working" as const,priority:5,tags:["security","dni","intelligence"]},

  // --- TIER 6: GOVERNMENT ACCOUNTABILITY & OVERSIGHT ---
  {id:"feed-695",name:"GAO Audit Reports",shortName:"GAO Audits",agency:"GAO",description:"Government Accountability Office audit reports.",rssUrl:"https://www.gao.gov/rss/reports.xml",website:"https://www.gao.gov",department:"",category:"Oversight & Audits",subCategory:"Audits",contentType:"Audit reports",updateFrequency:"",status:"working" as const,priority:6,tags:["oversight","gao","audit","reports"]},
  {id:"feed-696",name:"GAO Press Releases",shortName:"GAO Press",agency:"GAO",description:"GAO press releases.",rssUrl:"https://www.gao.gov/rss/press-releases.xml",website:"https://www.gao.gov",department:"",category:"Oversight & Audits",subCategory:"Press",contentType:"Press releases",updateFrequency:"",status:"working" as const,priority:6,tags:["oversight","gao","press"]},
  {id:"feed-697",name:"SSA OIG Fraud Alerts",shortName:"SSA OIG Fraud",agency:"SSA OIG",description:"Social Security Administration OIG fraud and scam warnings.",rssUrl:"https://oig.ssa.gov/rss",website:"https://oig.ssa.gov",department:"SSA",category:"Oversight & Audits",subCategory:"Fraud",contentType:"Fraud alerts",updateFrequency:"",status:"working" as const,priority:6,tags:["oversight","ssa","oig","fraud","scam"]},
];`;

if (!content.includes(feedsEndMarker)) {
  console.error('Could not find feeds end marker');
  process.exit(1);
}

content = content.replace(feedsEndMarker, `  {id:"feed-623",name:"Voice of America",shortName:"Voice of America",agency:"Voice of America",description:"Voice of America",rssUrl:"https://www.voanews.com/rssfeeds",website:"https://www.insidevoa.com/rssfeeds",department:"",category:"Diplomacy & Foreign Affairs",subCategory:"Diplomacy & Foreign Affairs",contentType:"Voice of America",updateFrequency:"",status:"unverified" as const,tags:["diplomacy & foreign affairs"]},` + newFeeds);

// Replace feedStats
const oldStats = `export const feedStats = {
  total: 623,
  byCategory: {
    "Oversight & Audits": 50,
    "Courts & Judiciary": 51,
    "Finance & Economy": 50,
    "Environment & Energy": 59,
    "Health & Science": 43,
    "Congress & Legislation": 34,
    "Defense & Security": 71,
    "General": 32,
    "Diplomacy & Foreign Affairs": 27,
    "Grants & Arts": 26,
    "Labor & Employment": 26,
    "Safety & Consumer Protection": 20,
    "Commerce & Trade": 25,
    "Rulemaking & Regulations": 14,
    "Development & Education": 16,
    "Executive & Press": 13,
    "Transportation": 16,
    "Agriculture & Food": 12,
    "Technology, Cybersecurity, & Space": 16,
    "Housing, Urban Development, & Infrastructure": 12,
    "Veterans Affairs, Healthcare, & Benefits": 10,
  },
  byStatus: { unverified: 623, working: 0, blocked: 0 },
};`;

const newStats = `export const feedStats = {
  total: 697,
  byCategory: {
    "Oversight & Audits": 52,
    "Courts & Judiciary": 51,
    "Finance & Economy": 57,
    "Environment & Energy": 78,
    "Health & Science": 55,
    "Congress & Legislation": 34,
    "Defense & Security": 73,
    "General": 32,
    "Diplomacy & Foreign Affairs": 28,
    "Grants & Arts": 26,
    "Labor & Employment": 26,
    "Safety & Consumer Protection": 33,
    "Commerce & Trade": 25,
    "Rulemaking & Regulations": 14,
    "Development & Education": 16,
    "Executive & Press": 13,
    "Transportation": 19,
    "Agriculture & Food": 12,
    "Technology, Cybersecurity, & Space": 16,
    "Housing, Urban Development, & Infrastructure": 12,
    "Veterans Affairs, Healthcare, & Benefits": 10,
  },
  byStatus: { unverified: 623, working: 74, blocked: 0 },
};`;

if (!content.includes(oldStats)) {
  console.error('Could not find feedStats');
  process.exit(1);
}

content = content.replace(oldStats, newStats);

// Add getFeedsByPriority helper
const oldHelpersEnd = `export const searchFeeds = (query: string): Feed[] => {
  const q = query.toLowerCase();
  return feeds.filter(f => f.name.toLowerCase().includes(q) || f.agency.toLowerCase().includes(q) || f.category.toLowerCase().includes(q) || f.tags.some(t => t.toLowerCase().includes(q)));
};`;

const newHelpersEnd = `export const searchFeeds = (query: string): Feed[] => {
  const q = query.toLowerCase();
  return feeds.filter(f => f.name.toLowerCase().includes(q) || f.agency.toLowerCase().includes(q) || f.category.toLowerCase().includes(q) || f.tags.some(t => t.toLowerCase().includes(q)));
};

export const getFeedsByPriority = (priority: number): Feed[] => feeds.filter(f => f.priority === priority);`;

if (!content.includes(oldHelpersEnd)) {
  console.error('Could not find helpers end');
  process.exit(1);
}

content = content.replace(oldHelpersEnd, newHelpersEnd);

fs.writeFileSync(filePath, content);
console.log('Updated feeds.ts successfully');
