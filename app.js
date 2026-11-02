// Penryn Prep Art Exhibition — parent-facing no-account bidding experience.
// This uses the public Supabase publishable key. Never put a secret/service-role key in browser code.
const SUPABASE_URL = 'https://jenhhohthawqavwwfsau.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZCgP6bzFtkV7iPhQVxCW5A_OvhRwFOt';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const cards = document.querySelector('#cards');
const bidDialog = document.querySelector('#bid');
const bidForm = document.querySelector('#bidform');
const submitButton = document.querySelector('#submitbid');
let artworks = [];
let summaries = {};
let selectedArtwork = null;
let filter = 'all';
const money = n => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(Number(n||0));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function timeLeft(value){const ms=new Date(value).getTime()-Date.now();if(ms<=0)return 'Auction ended';const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return d?`${d}d ${h}h ${m}m`: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',5500);}
function isLive(a){return a.is_active && new Date(a.ends_at).getTime()>Date.now();}
function render(){
 const visible=artworks.filter(a=>filter==='all'||(filter==='live'&&isLive(a))||(filter==='ended'&&!isLive(a)));
 if(!visible.length){cards.innerHTML='<p>No artwork is available in this section yet. Please check back soon.</p>';return;}
 cards.innerHTML=visible.map(a=>{const sum=summaries[a.id]||{highest_bid:Number(a.starting_bid||0),bid_count:0};const live=isLive(a);return `<article class="card"><img src="${escapeHtml(a.image_url||'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=85')}" alt="${escapeHtml(a.title)}"><div class="cardbody"><span class="meta">${escapeHtml(a.category||'Original artwork')}</span><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description||'A unique creation from our young artists.')}</p><div class="bidrow"><div><small>CURRENT HIGHEST BID</small><strong>${money(sum.highest_bid)}</strong></div><div class="timer"><small>TIME REMAINING</small><span data-end="${escapeHtml(a.ends_at)}">${timeLeft(a.ends_at)}</span></div></div><span class="meta">${Number(sum.bid_count||0)} bids</span><br><button class="green" data-bid="${a.id}" ${live?'':'disabled'}>${live?'Place a bid ↗':'Auction ended'}</button></div></article>`;}).join('');
}
async function refreshSummaries(){
 const results=await Promise.all(artworks.map(async a=>{const {data,error}=await client.rpc('get_auction_summary',{p_artwork_id:a.id});if(error){console.error('Summary error',error);return [a.id,{highest_bid:Number(a.starting_bid||0),bid_count:0}];}return [a.id,data?.[0]||{highest_bid:Number(a.starting_bid||0),bid_count:0}];}));
 summaries=Object.fromEntries(results);render();
}
async function loadArtworks(){
 cards.innerHTML='<p>Loading artwork…</p>';
 const {data,error}=await client.from('auction_artworks').select('id,title,description,category,image_url,starting_bid,ends_at,is_active').order('created_at',{ascending:false});
 if(error){console.error(error);cards.innerHTML='<p>We could not load the exhibition just now. Please refresh the page or try again shortly.</p>';return;}
 artworks=data||[];await refreshSummaries();
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));button.classList.add('active');filter=button.dataset.filter;render();}));
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>bidDialog.close()));
cards.addEventListener('click',event=>{const button=event.target.closest('[data-bid]');if(!button)return;selectedArtwork=artworks.find(a=>a.id===button.dataset.bid);if(!selectedArtwork)return;const sum=summaries[selectedArtwork.id]||{highest_bid:selectedArtwork.starting_bid,bid_count:0};document.querySelector('#bidtitle').textContent=selectedArtwork.title;document.querySelector('#bidcurrent').textContent=`Current highest bid: ${money(sum.highest_bid)}. Your bid must be higher.`;document.querySelector('#amount').min=Number(sum.highest_bid)+1;document.querySelector('#amount').value=Number(sum.highest_bid)+10;bidForm.reset();document.querySelector('#amount').min=Number(sum.highest_bid)+1;document.querySelector('#amount').value=Number(sum.highest_bid)+10;bidDialog.showModal();});
bidForm.addEventListener('submit',async event=>{
 event.preventDefault();if(!selectedArtwork)return;
 const fullName=document.querySelector('#bidname').value.trim();const phone=document.querySelector('#bidphone').value.trim();const amount=Number(document.querySelector('#amount').value);
 if(fullName.length<3||phone.replace(/\D/g,'').length<9||!Number.isFinite(amount)||amount<=0){toast('Please enter your full name, a valid cellphone number, and a bid amount.');return;}
 submitButton.disabled=true;submitButton.textContent='Submitting…';
 try{const {data,error}=await client.rpc('submit_auction_bid',{p_artwork_id:selectedArtwork.id,p_bidder_name:fullName,p_bidder_phone:phone,p_amount:amount});if(error)throw error;bidDialog.close();toast('Your bid has been submitted successfully. Thank you!');await refreshSummaries();}
 catch(error){console.error(error);toast(error.message||'We could not submit your bid. Please check the amount and try again.');}
 finally{submitButton.disabled=false;submitButton.textContent='Submit bid';}
});
loadArtworks();
setInterval(()=>{document.querySelectorAll('[data-end]').forEach(el=>el.textContent=timeLeft(el.dataset.end));},1000);
// Refresh public bid totals periodically; bidder names and phone numbers are never fetched by this page.
setInterval(refreshSummaries,15000);
