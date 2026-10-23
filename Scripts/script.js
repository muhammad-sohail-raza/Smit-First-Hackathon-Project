
const supabasUrl = 'https://yvhznvuvdbloqynhndyr.supabase.co';

const supabasKey = 'sb_publishable_QNS-XJSOO599J1OC9eKRUA_l0Z1g3tX';

const connect_DataBase = window.supabase.createClient(supabasUrl,supabasKey);


console.log("Supabase client initialized successfully!");

document.getElementById("connectionStatus").textContent = "Supabase client is ready!"; 

// 7U6Z48s1SDVVDNT7 (ya data basae ka password ha)