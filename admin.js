// Admin tools for Penryn Prep Art Exhibition. Uses existing admin authentication.
const SUPABASE_URL='https://jenhhohthawqavwwfsau.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_ZCgP6bzFtkV7iPhQVxCW5A_OvhRwFOt';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
const zar=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(Number(n||0));
function msg(id,t){$(id).textContent=t;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function adminCheck(){
 const {data:{user}}=await db.auth.getUser();
 if(!user){$('#loginpanel').classList.remove('hidden');$('#dashboard').classList.add('hidden');$('#logout').style.display='none';return;}
 const {data:profile,error}=await db.from('profiles').select('role').eq('id',user.id).single();
 if(error||profile?.role!=='admin'){await db.auth.signOut();msg('#loginmsg','This account does not have administrator access.');return;}
 $('#loginpanel').classList.add('hidden');$('#dashboard').classList.remove('hidden');$('#logout').style.display='inline-block';
 await Promise.all([loadArtworks(),loadBids()]);
}
$('#loginform').addEventListener('submit',async e=>{e.preventDefault();msg('#loginmsg','Signing in…');const {error}=await db.auth.signInWithPassword({email:$('#adminemail').value,password:$('#adminpassword').value});if(error){msg('#loginmsg',error.message);return;}await adminCheck();});
$('#logout').addEventListener('click',async()=>{await db.auth.signOut();await adminCheck();});
function clearForm(){$('#artform').reset();$('#artid').value='';$('#formtitle').textContent='Add artwork';$('#saveart').textContent='Save artwork';}
$('#clearform').addEventListener('click',clearForm);
async function loadArtworks(){
 const {data,error}=await db.from('auction_artworks').select('*').order('created_at',{ascending:false});
 if(error){$('#artrows').innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return;}
 $('#artrows').innerHTML=(data||[]).map(a=>`<tr><td><b>${esc(a.title)}</b><br><small>${esc(a.category||'')}</small></td><td>${zar(a.starting_bid)}</td><td>${new Date(a.ends_at).toLocaleString()}</td><td><span class="status">${a.is_active?'Active':'Hidden'}</span></td><td><button class="smallbtn" data-edit="${a.id}">Edit</button><button class="smallbtn danger" data-delete="${a.id}">Delete</button><button class="smallbtn" data-toggle="${a.id}" data-active="${a.is_active}">${a.is_active?'Hide':'Show'}</button></td></tr>`).join('')||'<tr><td colspan="5">No artwork added yet.</td></tr>';
}
$('#artrows').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit]')?.dataset.edit, del=e.target.closest('[data-delete]')?.dataset.delete, tog=e.target.closest('[data-toggle]');
 if(edit){const {data:a}=await db.from('auction_artworks').select('*').eq('id',edit).single();if(!a)return;$('#artid').value=a.id;$('#title').value=a.title;$('#description').value=a.description||'';$('#category').value=a.category||'';$('#starting').value=a.starting_bid;$('#ends').value=new Date(a.ends_at).toISOString().slice(0,16);$('#formtitle').textContent='Edit artwork';$('#saveart').textContent='Update artwork';window.scrollTo({top:0,behavior:'smooth'});}
 if(del&&confirm('Delete this artwork and its bids?')){const {error}=await db.from('auction_artworks').delete().eq('id',del);if(error)alert(error.message);else{await loadArtworks();await loadBids();}}
 if(tog){const {error}=await db.from('auction_artworks').update({is_active:tog.dataset.active!=='true'}).eq('id',tog.dataset.toggle);if(error)alert(error.message);else loadArtworks();}
});
$('#artform').addEventListener('submit',async e=>{
 e.preventDefault();$('#saveart').disabled=true;msg('#artmsg','Saving artwork…');
 try{
  let image_url=null;const file=$('#photo').files[0];
  if(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${crypto.randomUUID()}.${ext}`;const {error:upErr}=await db.storage.from('artwork-images').upload(path,file,{upsert:false,contentType:file.type});if(upErr)throw upErr;image_url=db.storage.from('artwork-images').getPublicUrl(path).data.publicUrl;}
  const payload={title:$('#title').value.trim(),description:$('#description').value.trim(),category:$('#category').value.trim(),starting_bid:Number($('#starting').value),ends_at:new Date($('#ends').value).toISOString()};
  if(image_url)payload.image_url=image_url;
  const id=$('#artid').value;const result=id?await db.from('auction_artworks').update(payload).eq('id',id):await db.from('auction_artworks').insert(payload);
  if(result.error)throw result.error;msg('#artmsg','Artwork saved.');clearForm();await loadArtworks();
 }catch(err){msg('#artmsg',err.message||'Could not save artwork.');}
 finally{$('#saveart').disabled=false;}
});
async function loadBids(){
 const {data,error}=await db.from('auction_bids').select('id,artwork_id,bidder_name,bidder_phone,amount,created_at,payment_status,collected,auction_artworks(title)').order('created_at',{ascending:false});
 if(error){$('#bidrows').innerHTML=`<tr><td colspan="7">${esc(error.message)}<br><small>Run the latest SQL setup if payment fields are missing.</small></td></tr>`;return;}
 $('#bidrows').innerHTML=(data||[]).map(b=>`<tr><td>${esc(b.auction_artworks?.title||'Artwork')}</td><td>${esc(b.bidder_name)}</td><td>${esc(b.bidder_phone)}</td><td><b>${zar(b.amount)}</b></td><td>${new Date(b.created_at).toLocaleString()}</td><td><select data-payment="${b.id}"><option value="pending" ${b.payment_status==='pending'?'selected':''}>Pending</option><option value="paid" ${b.payment_status==='paid'?'selected':''}>Paid</option></select></td><td><label><input type="checkbox" data-collected="${b.id}" ${b.collected?'checked':''}> Collected</label></td></tr>`).join('')||'<tr><td colspan="7">No bids received yet.</td></tr>';
}
$('#bidrows').addEventListener('change',async e=>{
 const pay=e.target.dataset.payment, col=e.target.dataset.collected;
 if(pay){const {error}=await db.from('auction_bids').update({payment_status:e.target.value}).eq('id',pay);if(error)alert(error.message);}
 if(col){const {error}=await db.from('auction_bids').update({collected:e.target.checked}).eq('id',col);if(error)alert(error.message);}
});
db.auth.onAuthStateChange(()=>{setTimeout(adminCheck,0);});
adminCheck();