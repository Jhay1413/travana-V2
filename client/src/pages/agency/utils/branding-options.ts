export const SUGGESTED_BRAND_COLORS = [
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#9333ea",
  "#db2777",
];

export const COMMON_TIMEZONES = [
  "Europe/London",
  "Europe/Paris",
  "Europe/Madrid",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export const CURRENCIES = ["GBP", "EUR", "USD", "AUD", "CAD", "AED", "SGD"];

export const UK_COUNTIES = [
  // England
  "Bedfordshire", "Berkshire", "Bristol", "Buckinghamshire", "Cambridgeshire", "Cheshire", "City of London",
  "Cornwall", "Cumbria", "Derbyshire", "Devon", "Dorset", "Durham", "East Riding of Yorkshire", "East Sussex",
  "Essex", "Gloucestershire", "Greater London", "Greater Manchester", "Hampshire", "Herefordshire",
  "Hertfordshire", "Isle of Wight", "Kent", "Lancashire", "Leicestershire", "Lincolnshire", "Merseyside",
  "Norfolk", "North Yorkshire", "Northamptonshire", "Northumberland", "Nottinghamshire", "Oxfordshire",
  "Rutland", "Shropshire", "Somerset", "South Yorkshire", "Staffordshire", "Suffolk", "Surrey", "Tyne and Wear",
  "Warwickshire", "West Midlands", "West Sussex", "West Yorkshire", "Wiltshire", "Worcestershire",
  // Scotland (council areas)
  "Aberdeen City", "Aberdeenshire", "Angus", "Argyll and Bute", "City of Edinburgh", "Clackmannanshire",
  "Dumfries and Galloway", "Dundee City", "East Ayrshire", "East Dunbartonshire", "East Lothian",
  "East Renfrewshire", "Falkirk", "Fife", "Glasgow City", "Highland", "Inverclyde", "Midlothian", "Moray",
  "Na h-Eileanan Siar", "North Ayrshire", "North Lanarkshire", "Orkney Islands", "Perth and Kinross",
  "Renfrewshire", "Scottish Borders", "Shetland Islands", "South Ayrshire", "South Lanarkshire", "Stirling",
  "West Dunbartonshire", "West Lothian",
  // Wales (principal areas)
  "Blaenau Gwent", "Bridgend", "Caerphilly", "Cardiff", "Carmarthenshire", "Ceredigion", "Conwy", "Denbighshire",
  "Flintshire", "Gwynedd", "Isle of Anglesey", "Merthyr Tydfil", "Monmouthshire", "Neath Port Talbot", "Newport",
  "Pembrokeshire", "Powys", "Rhondda Cynon Taf", "Swansea", "Torfaen", "Vale of Glamorgan", "Wrexham",
  // Northern Ireland
  "County Antrim", "County Armagh", "County Down", "County Fermanagh", "County Londonderry", "County Tyrone",
].sort((a, b) => a.localeCompare(b));
