/* HarvestLink browser app. Only the public Supabase publishable key belongs here. */
const SUPABASE_URL = "https://ivdunjgkvqcbecyvjctk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_45446mdcAdaAlJCawB_oWw_peRB18ve";
const AUTH_REDIRECT_URL = "https://harvestlink-sand.vercel.app";
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const demoProducts = [
  {id:"demo-tomatoes",itemType:"produce",name:"Heirloom tomatoes",category:"vegetables",price:180,unit:"kg",quantity:34,location:"Kiambu",farmer_name:"Wanjiku's Garden",photo_url:"https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=85"},
  {id:"demo-avocado",itemType:"produce",name:"Hass avocados",category:"fruits",price:220,unit:"kg",quantity:26,location:"Murang'a",farmer_name:"Green Valley Farm",photo_url:"https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=900&q=85"},
  {id:"demo-kale",itemType:"produce",name:"Organic sukuma wiki",category:"vegetables",price:80,unit:"bunch",quantity:50,location:"Nakuru",farmer_name:"Amani Growers",photo_url:"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=900&q=85"},
  {id:"demo-mango",itemType:"produce",name:"Sweet mangoes",category:"fruits",price:160,unit:"kg",quantity:40,location:"Machakos",farmer_name:"Sunrise Orchard",photo_url:"https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=900&q=85"},
  {id:"demo-carrots",itemType:"produce",name:"Crunchy carrots",category:"vegetables",price:120,unit:"kg",quantity:30,location:"Limuru",farmer_name:"Wanjiku's Garden",photo_url:"https://images.unsplash.com/photo-1445282768818-728615cc910a?auto=format&fit=crop&w=900&q=85"},
  {id:"demo-beans",itemType:"produce",name:"Rose coco beans",category:"grains",price:250,unit:"kg",quantity:18,location:"Embu",farmer_name:"Muthoni Family Farm",photo_url:"https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=900&q=85"},
  {id:"demo-potatoes",itemType:"produce",name:"Golden potatoes",category:"vegetables",price:110,unit:"kg",quantity:60,location:"Nyandarua",farmer_name:"Kip's Farm",photo_url:"https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=85"}
];

function readSavedCart(){
  try{
    const saved=JSON.parse(localStorage.getItem("harvestlink-cart")||"{}");
    return Object.fromEntries(Object.entries(saved).map(([key,qty])=>[key.includes(":")?key:`produce:${key}`,Number(qty)||0]).filter(([,qty])=>qty>0));
  }catch{return {}}
}
const state={products:demoProducts,category:"all",query:"",cart:readSavedCart(),user:null,profile:null,client:null,mode:"login",cartSave:Promise.resolve()};
const $=selector=>document.querySelector(selector);
const money=value=>`KES ${Number(value||0).toLocaleString("en-KE")}`;
function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function photo(product){return product.photo_url||product.image_url||"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85"}
function relation(value){return Array.isArray(value)?value[0]||{}:value||{}}
function productKey(product){return `${product.itemType}:${product.id}`}
function findProduct(key){return state.products.find(product=>productKey(product)===key)}
function notify(message){const toast=$("#toast");toast.textContent=message;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),2800)}

function renderProducts(){
  const list=state.products.filter(product=>(state.category==="all"||product.category===state.category)&&`${product.name} ${product.farmer_name||""} ${product.location||""}`.toLowerCase().includes(state.query.toLowerCase()));
  $("#product-grid").innerHTML=list.map(product=>{
    const key=productKey(product),stock=Math.max(0,Number(product.quantity)||0),out=stock===0;
    return `<article class="product-card" data-product="${esc(key)}"><div class="product-photo"><img loading="lazy" src="${esc(photo(product))}" alt="${esc(product.name)}" onerror="this.hidden=true"><span class="product-label">${esc((product.category||"fresh").toUpperCase())}</span></div><div class="product-info"><div class="product-farmer">${esc(product.farmer_name||"Local farmer")} · ${esc(product.location||"Kenya")}</div><h3>${esc(product.name)}</h3><div class="product-meta"><span class="product-price">${money(product.price)} <small>/ ${esc(product.unit||"kg")}</small></span><span class="product-stock ${out?"out-of-stock":""}">${out?"Out of stock":`${stock} available`}</span></div><div class="product-purchase"><label class="visually-hidden" for="qty-${esc(key)}">Quantity for ${esc(product.name)}</label><input id="qty-${esc(key)}" type="number" min="1" max="${stock}" value="1" data-product-qty="${esc(key)}" ${out?"disabled":""}><button class="small-action" data-add="${esc(key)}" ${out?"disabled":""}>${out?"Out of stock":"Add to cart"}</button></div></div></article>`;
  }).join("");
  $("#catalog-message").textContent=list.length?"":(state.client?"No matching produce found. Try another search.":"Showing sample produce. Connect Supabase to load live listings.");
}

function cartRows(){return Object.entries(state.cart).map(([key,quantity])=>({key,product:findProduct(key),quantity:Number(quantity)})).filter(row=>row.product&&row.quantity>0)}
function cartQuantity(){return Object.values(state.cart).reduce((sum,value)=>sum+Number(value||0),0)}
function persistCart(){
  localStorage.setItem("harvestlink-cart",JSON.stringify(state.cart));
  $("#cart-count").textContent=cartQuantity();
  if(state.user&&state.profile?.role==="buyer"&&state.client)state.cartSave=state.cartSave.then(saveRemoteCart).catch(error=>notify(`Cart sync failed: ${error.message}`));
}
function cartPayload(rows=cartRows()){return rows.map(row=>({item_type:row.product.itemType,product_id:row.product.id,quantity:row.quantity}))}
async function saveRemoteCart(){if(!state.client||state.profile?.role!=="buyer")return;const {error}=await state.client.rpc("save_my_cart",{p_items:cartPayload()});if(error)throw error}
function updateCartQuantity(key,next){
  const product=findProduct(key);if(!product)return;
  const quantity=Math.max(0,Math.min(Number(product.quantity)||0,Math.trunc(Number(next)||0)));
  if(quantity===0)delete state.cart[key];else state.cart[key]=quantity;
  persistCart();renderCart();
}
function addToCart(key,quantity=1){
  const product=findProduct(key);if(!product)return;
  const stock=Math.max(0,Number(product.quantity)||0);if(!stock){notify(`${product.name} is out of stock`);return;}
  const existing=Number(state.cart[key]||0),requested=Math.max(1,Math.trunc(Number(quantity)||1));
  state.cart[key]=Math.min(stock,existing+requested);persistCart();notify(`${product.name} added to cart`);
  if(existing+requested>stock)notify(`Only ${stock} ${product.unit} of ${product.name} are available`);
}
function renderCart(){
  const rows=cartRows(),groups=new Map();
  rows.forEach(row=>{const groupKey=row.product.farmer_id||row.product.farmer_name||"local-farmer";if(!groups.has(groupKey))groups.set(groupKey,{name:row.product.farmer_name||"Local farmer",rows:[]});groups.get(groupKey).rows.push(row)});
  if(!rows.length){$("#cart-items").innerHTML='<p class="cart-empty">Your cart is empty. Add something fresh to get started.</p>';$("#cart-total").textContent=money(0);$("#checkout-button").disabled=true;$("#checkout-button").hidden=false;$("#checkout-form").classList.add("hidden");return;}
  $("#checkout-button").disabled=false;
  $("#cart-items").innerHTML=[...groups.values()].map(group=>{
    const subtotal=group.rows.reduce((sum,row)=>sum+row.product.price*row.quantity,0);
    return `<section class="cart-farmer-group"><h3>${esc(group.name)}</h3>${group.rows.map(({key,product,quantity})=>`<div class="cart-row"><img src="${esc(photo(product))}" alt="" onerror="this.hidden=true"><div class="cart-row-info"><strong>${esc(product.name)}</strong><small>${money(product.price)} / ${esc(product.unit||"kg")}</small><small>Item subtotal: ${money(product.price*quantity)}</small></div><div class="cart-controls"><div class="qty-control"><button data-qty="${esc(key)}" data-delta="-1" aria-label="Remove one">−</button><span>${quantity}</span><button data-qty="${esc(key)}" data-delta="1" aria-label="Add one" ${quantity>=product.quantity?"disabled":""}>+</button></div><button class="small-action danger" data-remove="${esc(key)}">Remove</button></div></div>`).join("")}<div class="farmer-subtotal"><span>${esc(group.name)} subtotal</span><strong>${money(subtotal)}</strong></div></section>`;
  }).join("");
  $("#cart-total").textContent=money(rows.reduce((sum,row)=>sum+row.product.price*row.quantity,0));
}

function openAuth(mode="login"){state.mode=mode;syncAuth();$("#account-modal").showModal()}
function syncAuth(){
  const registering=state.mode==="register";
  document.querySelectorAll(".auth-tab").forEach(button=>button.classList.toggle("active",button.dataset.mode===state.mode));
  document.querySelectorAll(".register-only").forEach(field=>field.classList.toggle("hidden",!registering));
  $("#full-name").required=registering;$("#account-role").required=registering;
  $("#auth-title").textContent=registering?"Join the community.":"Good to see you.";
  $("#auth-submit").innerHTML=(registering?"Create account":"Sign in")+" <span>→</span>";
  $("#auth-hint").textContent=state.client?"":SUPABASE_CONFIGURED?"Supabase is configured but its client library did not load. Refresh the page or check your connection.":"Demo mode: Supabase credentials are missing.";
}
function authMessage(error){
  const message=(error?.message||"").toLowerCase();
  if(/invalid login credentials|invalid credentials/.test(message))return "Incorrect email or password. Check your details and try again.";
  if(/already registered|user already exists/.test(message))return "That email is already registered. Sign in instead.";
  if(/email not confirmed/.test(message))return "Confirm your email from the latest HarvestLink email, then sign in again.";
  if(/fetch|network|failed to|load failed/.test(message))return "Network error. Check your connection and try again.";
  return error?.message||"Something went wrong. Please try again.";
}
function showAuthMessage(message,type="error"){$("#auth-hint").textContent=message;$("#auth-hint").classList.remove("auth-error","auth-loading");if(type)$("#auth-hint").classList.add(`auth-${type}`)}
async function refreshProfile(){if(!state.client||!state.user)return;const {data,error}=await state.client.from("users").select("*").eq("id",state.user.id).maybeSingle();if(error)throw error;state.profile=data}
async function loadProducts(){
  if(!state.client)return;
  const [allocationResult,produceResult]=await Promise.all([
    state.client.from("farmer_products").select("id,farmer_id,allocated_qty,available_qty,sold_qty,price,farmer_name,is_active,default_allocation(product_name,category,unit,image_url,is_active)").order("created_at",{ascending:false}),
    state.client.from("produce").select("id,farmer_id,name,price,unit,quantity,location,photo_url,is_approved,is_rejected,categories(name)").eq("is_approved",true).eq("is_rejected",false).order("created_at",{ascending:false})
  ]);
  const error=allocationResult.error||produceResult.error;
  if(error){console.warn("Could not load marketplace listings",error.message);$("#catalog-message").textContent="Marketplace setup is incomplete. Run migration_marketplace.sql in Supabase, then refresh.";return;}
  const allocations=(allocationResult.data||[]).filter(row=>row.is_active&&row.default_allocation?.is_active).map(row=>{const config=relation(row.default_allocation);return {id:row.id,itemType:"allocation",farmer_id:row.farmer_id,farmer_name:row.farmer_name,name:config.product_name,category:config.category,price:Number(row.price),unit:config.unit,quantity:Number(row.available_qty),allocated_qty:Number(row.allocated_qty),sold_qty:Number(row.sold_qty),photo_url:config.image_url,location:"Kenya"}});
  const legacy=(produceResult.data||[]).map(row=>({id:row.id,itemType:"produce",farmer_id:row.farmer_id,name:row.name,category:(relation(row.categories).name||"vegetables").toLowerCase(),price:Number(row.price),unit:row.unit,quantity:Number(row.quantity),photo_url:row.photo_url,location:row.location||"Kenya",farmer_name:"Local farmer"}));
  state.products=[...allocations,...legacy];renderProducts();
}

async function restoreAndMergeCart(){
  if(!state.client||!state.user||state.profile?.role!=="buyer")return;
  await loadProducts();
  const guest={...state.cart};let remote={};
  const {data:cart,error:cartError}=await state.client.from("carts").select("id").eq("buyer_id",state.user.id).maybeSingle();
  if(cartError)throw cartError;
  if(cart){const {data:items,error}=await state.client.from("cart_items").select("item_type,farmer_product_id,produce_id,quantity").eq("cart_id",cart.id);if(error)throw error;(items||[]).forEach(item=>{const key=`${item.item_type}:${item.item_type==="allocation"?item.farmer_product_id:item.produce_id}`;remote[key]=Number(item.quantity)})}
  const merged={...remote},adjusted=[];
  Object.entries(guest).forEach(([key,quantity])=>{const product=findProduct(key);if(!product)return;merged[key]=(merged[key]||0)+Number(quantity)});
  Object.entries(merged).forEach(([key,requested])=>{const product=findProduct(key);if(!product){delete merged[key];return;}merged[key]=Math.min(Number(requested)||0,Number(product.quantity)||0);if(merged[key]<(Number(requested)||0))adjusted.push(product.name);if(!merged[key])delete merged[key]});
  state.cart=merged;persistCart();renderCart();await state.cartSave;
  if(adjusted.length)notify(`Cart stock updated for ${adjusted.join(", ")}`);
}
async function authSubmit(event){
  event.preventDefault();const button=$("#auth-submit"),label=button.innerHTML;
  if(!state.client){showAuthMessage(SUPABASE_CONFIGURED?"Supabase is configured but unavailable. Check your connection and refresh.":"Account access is unavailable in demo mode.");return;}
  const email=$("#auth-email").value.trim(),password=$("#auth-password").value;button.disabled=true;button.textContent=state.mode==="login"?"Signing in…":"Creating account…";showAuthMessage("Please wait…","loading");
  try{
    const result=state.mode==="register"
      ?await state.client.auth.signUp({email,password,options:{emailRedirectTo:AUTH_REDIRECT_URL,data:{full_name:$("#full-name").value.trim(),role:$("#account-role").value}}})
      :await state.client.auth.signInWithPassword({email,password});
    if(result.error){showAuthMessage(authMessage(result.error));return;}
    if(state.mode==="register"&&!result.data.session){$("#account-modal").close();notify("Account created. Confirm your email before signing in.");return;}
    state.user=result.data.user;await refreshProfile();if(!state.profile)throw new Error("Your HarvestLink profile was not found. Contact the site administrator.");
    await restoreAndMergeCart();$("#account-modal").close();syncAccount();syncDashboard();
    notify(state.mode==="register"?"Account created. Welcome to HarvestLink!":"Welcome back!");await routeByRole();
  }catch(error){showAuthMessage(authMessage(error));}
  finally{button.disabled=false;button.innerHTML=label;}
}
function syncAccount(){$("#account-button").innerHTML=state.user?`♙ <span>${esc(state.profile?.full_name||state.user.email.split("@")[0])} · Sign out</span>`:`♙ <span>Sign in</span>`}
function syncDashboard(){$("#dashboard-button").hidden=false}
async function routeByRole(){if(!state.profile)return;if(state.profile.role==="buyer"){location.hash="#catalogue";return;}await loadDashboard();}

function allocationCard(row){
  const config=relation(row.default_allocation),remaining=Math.max(0,row.allocated_qty-row.sold_qty),out=Number(row.available_qty)===0;
  return `<article class="allocation-card"><img src="${esc(config.image_url||"")}" alt="${esc(config.product_name)}" onerror="this.hidden=true"><div class="allocation-body"><div class="allocation-title"><div><h4>${esc(config.product_name)}</h4><span class="stock-status ${!row.is_active?"inactive":out?"out-of-stock":""}">${!row.is_active?"Removed":out?"Out of stock":"Available"}</span></div><span class="allocation-quantity">Allocated ${row.allocated_qty} ${esc(config.unit)} · Sold ${row.sold_qty} ${esc(config.unit)}</span></div><div class="allocation-edit"><label>Available<input type="number" min="0" max="${remaining}" value="${row.available_qty}" data-allocation-qty="${row.id}"></label><label>Price / ${esc(config.unit)}<input type="number" min="0.01" step="0.01" value="${row.price}" data-allocation-price="${row.id}"></label><button class="small-action" data-save-allocation="${row.id}">Save</button><button class="small-action ${row.is_active?"danger":""}" data-toggle-allocation="${row.id}" data-active="${row.is_active}">${row.is_active?"Remove":"Restore"}</button></div></div></article>`;
}

async function loadFarmerDashboard(root){
  const [allocationResult,categoryResult,produceResult,orderResult]=await Promise.all([
    state.client.from("farmer_products").select("id,product_id,allocated_qty,available_qty,sold_qty,price,is_active,default_allocation(product_name,unit,image_url)").eq("farmer_id",state.user.id).order("created_at"),
    state.client.from("categories").select("id,name").order("name"),
    state.client.from("produce").select("id,name,price,quantity,unit,is_approved,is_rejected").eq("farmer_id",state.user.id).order("created_at",{ascending:false}),
    state.client.from("orders").select("id,status,created_at,delivery_name,delivery_phone,delivery_location,order_items(quantity,unit_price,item_name,item_unit,farmer_product_id,produce_id,produce(name,farmer_id),farmer_products(farmer_id,default_allocation(product_name)))").order("created_at",{ascending:false}).limit(30)
  ]);
  const error=allocationResult.error||categoryResult.error||produceResult.error||orderResult.error;
  if(error){root.innerHTML=`<p class="form-hint">Could not load your workspace: ${esc(error.message)}</p>`;return;}
  const allocations=allocationResult.data||[],categories=categoryResult.data||[],listings=produceResult.data||[];
  const orderRows=(orderResult.data||[]).map(order=>({...order,ownItems:(order.order_items||[]).filter(item=>item.farmer_products?.farmer_id===state.user.id||item.produce?.farmer_id===state.user.id)})).filter(order=>order.ownItems.length);
  root.innerHTML=`<h3 class="dashboard-subtitle">Your starter allocation</h3><p class="form-hint">Edit your available stock and prices. Sold stock is recorded separately.</p><div class="allocation-grid">${allocations.map(allocationCard).join("")||'<p class="form-hint">No starter items. Ask an admin to check the allocation settings.</p>'}</div><h3 class="dashboard-subtitle">Orders for your farm</h3><div class="dashboard-list">${orderRows.map(order=>`<article class="farmer-order"><div><strong>New order · ${esc(order.status)}</strong><small>${esc(order.delivery_name||"Buyer")} · ${esc(order.delivery_phone||"")} · ${esc(order.delivery_location||"")}</small><small>${order.ownItems.map(item=>`${esc(item.item_name||item.produce?.name||relation(relation(item.farmer_products).default_allocation).product_name||"Produce")} × ${item.quantity}`).join(", ")}</small></div><time>${new Date(order.created_at).toLocaleDateString()}</time></article>`).join("")||'<p class="form-hint">No orders yet. New buyer orders will appear here.</p>'}</div><h3 class="dashboard-subtitle">Add another listing</h3><form id="listing-form"><input type="hidden" name="id"><div class="form-field"><label>Produce name</label><input name="name" required minlength="2" maxlength="120"></div><div class="form-field"><label>Category</label><select name="category_id" required>${categories.map(category=>`<option value="${category.id}">${esc(category.name)}</option>`).join("")}</select></div><div class="form-field"><label>Price (KES)</label><input name="price" type="number" min="1" step="0.01" required></div><div class="form-field"><label>Quantity</label><input name="quantity" type="number" min="0" required></div><div class="form-field"><label>Unit</label><select name="unit"><option>kg</option><option>bunch</option><option>piece</option><option>crate</option><option>bag</option><option>litre</option></select></div><div class="form-field"><label>Location</label><input name="location" maxlength="120"></div><div class="form-field"><label>Photo URL</label><input name="photo_url" type="url"></div><button class="button button-primary">Save listing <span>→</span></button></form><h3 class="dashboard-subtitle">Your other listings</h3><div class="dashboard-list">${listings.map(product=>`<div class="dashboard-row"><div><strong>${esc(product.name)}</strong><small>${money(product.price)} / ${esc(product.unit)} · ${product.quantity} available · ${product.is_rejected?"Rejected":product.is_approved?"Approved":"Pending review"}</small></div><button data-edit="${product.id}" class="small-action">Edit</button><button data-delete="${product.id}" class="small-action danger">Remove</button></div>`).join("")||'<p class="form-hint">No other listings yet.</p>'}</div>`;
  root.querySelector("#listing-form").onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));data.farmer_id=state.user.id;data.price=Number(data.price);data.quantity=Number(data.quantity);data.is_approved=false;data.is_rejected=false;const id=data.id;delete data.id;const response=id?await state.client.from("produce").update(data).eq("id",id).eq("farmer_id",state.user.id):await state.client.from("produce").insert(data);if(response.error){notify(authMessage(response.error));return;}notify(id?"Listing updated and sent for review":"Listing submitted for approval");await loadProducts();await loadDashboard();};
  root.querySelectorAll("[data-save-allocation]").forEach(button=>button.onclick=async()=>{const id=button.dataset.saveAllocation,qty=Number(root.querySelector(`[data-allocation-qty="${id}"]`).value),price=Number(root.querySelector(`[data-allocation-price="${id}"]`).value);if(!Number.isInteger(qty)||qty<0||price<=0){notify("Enter a valid stock quantity and price");return;}const response=await state.client.from("farmer_products").update({available_qty:qty,price,is_active:true}).eq("id",id).eq("farmer_id",state.user.id);if(response.error){notify(authMessage(response.error));return;}notify("Starter listing updated");await loadProducts();await loadDashboard();});
  root.querySelectorAll("[data-toggle-allocation]").forEach(button=>button.onclick=async()=>{const active=button.dataset.active==="true",response=await state.client.from("farmer_products").update({is_active:!active}).eq("id",button.dataset.toggleAllocation).eq("farmer_id",state.user.id);if(response.error){notify(authMessage(response.error));return;}notify(active?"Starter item removed":"Starter item restored");await loadProducts();await loadDashboard();});
  root.querySelectorAll("[data-edit]").forEach(button=>button.onclick=async()=>{const {data,error}=await state.client.from("produce").select("*").eq("id",button.dataset.edit).single();if(error){notify(authMessage(error));return;}const form=root.querySelector("#listing-form");for(const [key,value] of Object.entries(data||{}))if(form.elements[key])form.elements[key].value=value;form.scrollIntoView({behavior:"smooth",block:"start"});});
  root.querySelectorAll("[data-delete]").forEach(button=>button.onclick=async()=>{const {error}=await state.client.from("produce").delete().eq("id",button.dataset.delete).eq("farmer_id",state.user.id);if(error){notify(authMessage(error));return;}notify("Listing removed");await loadProducts();await loadDashboard();});
}

async function loadAdminDashboard(root){
  const [users,listings,orders,allocationResult]=await Promise.all([
    state.client.from("users").select("id,full_name,role,location").eq("role","farmer").eq("is_approved",false).eq("is_rejected",false),
    state.client.from("produce").select("id,name,price,quantity,farmer_id").eq("is_approved",false).eq("is_rejected",false),
    state.client.from("orders").select("id,buyer_id,status,created_at,delivery_name,delivery_phone,delivery_location,order_items(quantity,unit_price,item_name,item_unit,produce(name),farmer_products(default_allocation(product_name)))").order("created_at",{ascending:false}).limit(30),
    state.client.from("default_allocation").select("id,product_name,category,unit,default_quantity,default_price_per_unit,image_url,is_active").order("product_name")
  ]);
  const failure=users.error||listings.error||orders.error||allocationResult.error;
  if(failure){root.innerHTML=`<p class="form-hint">Could not load admin data: ${esc(failure.message)}</p>`;return;}
  root.innerHTML=`<h3 class="dashboard-subtitle">Default farmer allocation settings</h3><p class="form-hint">Changes apply to farmers who have not customized their starter item.</p><div class="dashboard-list">${(allocationResult.data||[]).map(item=>`<form class="allocation-admin-row" data-allocation-admin="${item.id}"><label>Product<input name="product_name" value="${esc(item.product_name)}" required></label><label>Unit<select name="unit"><option ${item.unit==="kg"?"selected":""}>kg</option><option ${item.unit==="bunch"?"selected":""}>bunch</option></select></label><label>Default stock<input name="default_quantity" type="number" min="0" value="${item.default_quantity}" required></label><label>Price (KES)<input name="default_price_per_unit" type="number" min="0.01" step="0.01" value="${item.default_price_per_unit}" required></label><label class="admin-allocation-active"><input name="is_active" type="checkbox" ${item.is_active?"checked":""}> Active</label><button class="small-action">Save</button></form>`).join("")}</div><h3 class="dashboard-subtitle">Farmer approvals</h3><div class="dashboard-list">${(users.data||[]).map(user=>`<div class="dashboard-row"><div><strong>${esc(user.full_name)}</strong><small>${esc(user.location||"Farmer account awaiting review")}</small></div><button class="small-action" data-approve-user="${user.id}">Approve</button><button class="small-action danger" data-reject-user="${user.id}">Reject</button></div>`).join("")||'<p class="form-hint">No farmer accounts waiting.</p>'}</div><h3 class="dashboard-subtitle">Listing approvals</h3><div class="dashboard-list">${(listings.data||[]).map(product=>`<div class="dashboard-row"><div><strong>${esc(product.name)}</strong><small>${money(product.price)} · ${product.quantity} available</small></div><button class="small-action" data-approve-listing="${product.id}">Approve</button><button class="small-action danger" data-reject-listing="${product.id}">Reject</button></div>`).join("")||'<p class="form-hint">No listings waiting.</p>'}</div><h3 class="dashboard-subtitle">Orders</h3><div class="dashboard-list">${(orders.data||[]).map(order=>{const lines=(order.order_items||[]).map(item=>`${esc(item.item_name||item.produce?.name||relation(item.farmer_products?.default_allocation).product_name||"Produce")} × ${item.quantity}`).join(", ");return `<div class="dashboard-row order-row"><div><strong>Order ${order.id.slice(0,8)} · ${esc(order.status)}</strong><small>${esc(order.delivery_name||"")} · ${esc(order.delivery_phone||"")} · ${esc(order.delivery_location||"")}</small><small>${lines}</small></div><select data-status="${order.id}" aria-label="Order status"><option ${order.status==="placed"?"selected":""}>placed</option><option ${order.status==="confirmed"?"selected":""}>confirmed</option><option ${order.status==="dispatched"?"selected":""}>dispatched</option><option ${order.status==="delivered"?"selected":""}>delivered</option><option ${order.status==="cancelled"?"selected":""}>cancelled</option></select></div>`}).join("")||'<p class="form-hint">No orders yet.</p>'}</div>`;
  root.querySelectorAll("[data-allocation-admin]").forEach(form=>form.onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(form));data.default_quantity=Number(data.default_quantity);data.default_price_per_unit=Number(data.default_price_per_unit);data.is_active=form.elements.is_active.checked;const {error}=await state.client.from("default_allocation").update(data).eq("id",form.dataset.allocationAdmin);if(error){notify(authMessage(error));return;}notify("Default allocation saved");await loadProducts();await loadDashboard();});
  root.querySelectorAll("[data-approve-user]").forEach(button=>button.onclick=async()=>{const {error}=await state.client.from("users").update({is_approved:true,is_rejected:false}).eq("id",button.dataset.approveUser);if(error)notify(authMessage(error));else{notify("Farmer approved; starter products are ready");await loadDashboard();}});
  root.querySelectorAll("[data-reject-user]").forEach(button=>button.onclick=async()=>{const {error}=await state.client.from("users").update({is_approved:false,is_rejected:true}).eq("id",button.dataset.rejectUser);if(error)notify(authMessage(error));else{notify("Farmer application rejected");await loadDashboard();}});
  root.querySelectorAll("[data-approve-listing]").forEach(button=>button.onclick=async()=>{const {error}=await state.client.from("produce").update({is_approved:true,is_rejected:false}).eq("id",button.dataset.approveListing);if(error)notify(authMessage(error));else{notify("Listing approved");await loadProducts();await loadDashboard();}});
  root.querySelectorAll("[data-reject-listing]").forEach(button=>button.onclick=async()=>{const {error}=await state.client.from("produce").update({is_approved:false,is_rejected:true}).eq("id",button.dataset.rejectListing);if(error)notify(authMessage(error));else{notify("Listing rejected");await loadProducts();await loadDashboard();}});
  root.querySelectorAll("[data-status]").forEach(select=>select.onchange=async()=>{const {error}=await state.client.from("orders").update({status:select.value,updated_at:new Date().toISOString()}).eq("id",select.dataset.status);if(error)notify(authMessage(error));else notify("Order status updated");});
}

async function loadDashboard(){
  if(!state.client||!state.profile)return;const root=$("#dashboard-content");root.innerHTML="<p>Loading workspace…</p>";$("#dashboard-title").textContent=state.profile.role==="admin"?"Admin dashboard":"Your farm";$("#dashboard-modal").showModal();
  if(state.profile.role==="farmer"&&!state.profile.is_approved){root.innerHTML=`<section class="pending-notice"><div class="eyebrow">FARMER ACCOUNT</div><h3>${state.profile.is_rejected?"Your farmer application was declined":"Your farmer account is awaiting approval"}</h3><p>${state.profile.is_rejected?"An administrator reviewed your application. Please contact HarvestLink for next steps.":"Thanks for joining HarvestLink. An administrator will review your account. You can manage your starter goods after approval."}</p></section>`;return;}
  if(state.profile.role==="farmer")return loadFarmerDashboard(root);
  if(state.profile.role==="admin")return loadAdminDashboard(root);
  root.innerHTML='<p class="form-hint">Your buyer account is ready. Browse the shop to add products to your cart.</p>';
}

function openCheckout(){
  if(!cartRows().length){notify("Your cart is empty");return;}
  if(!state.user){$("#cart-modal").close();openAuth("login");notify("Sign in as a buyer to check out");return;}
  if(state.profile?.role!=="buyer"){notify("Checkout is available to buyer accounts");return;}
  $("#delivery-name").value=state.profile.full_name||"";$("#delivery-phone").value=state.profile.phone||"";$("#delivery-location").value=state.profile.location||"";
  $("#checkout-message").textContent="";$("#checkout-form").classList.remove("hidden");$("#checkout-button").hidden=true;$("#checkout-form").scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function placeOrder(event){
  event.preventDefault();if(!state.client||state.profile?.role!=="buyer"){notify("Sign in as a buyer to check out");return;}
  const form=event.currentTarget,button=form.querySelector("button[type=submit]"),label=button.textContent;button.disabled=true;button.textContent="Checking stock…";
  const items=cartPayload();
  try{
    const {data,error}=await state.client.rpc("checkout_marketplace",{p_delivery_name:$("#delivery-name").value.trim(),p_delivery_phone:$("#delivery-phone").value.trim(),p_delivery_location:$("#delivery-location").value.trim(),p_items:items});
    if(error)throw error;
    if(!data?.ok){
      await loadProducts();
      (data?.issues||[]).forEach(issue=>{const key=`${issue.item_type}:${issue.product_id}`,available=Number(issue.available)||0,product=findProduct(key);if(!product||available===0)delete state.cart[key];else state.cart[key]=Math.min(available,Number(product.quantity)||0);});
      persistCart();renderCart();$("#checkout-message").textContent="Some items had less stock than requested. Your cart was adjusted to the available quantities. Review it and submit again.";return;
    }
    state.cart={};persistCart();$("#cart-modal").close();await loadProducts();notify("Order placed. Pay on delivery; M-Pesa is coming soon.");
  }catch(error){$("#checkout-message").textContent=authMessage(error);}
  finally{button.disabled=false;button.textContent=label;}
}

function showProduct(key){
  const product=findProduct(key);if(!product)return;const stock=Math.max(0,Number(product.quantity)||0),out=stock===0;
  $("#product-detail").innerHTML=`<img class="product-detail-image" src="${esc(photo(product))}" alt="${esc(product.name)}" onerror="this.hidden=true"><div class="eyebrow">${esc((product.category||"fresh").toUpperCase())} · ${esc(product.location||"Kenya")}</div><h2>${esc(product.name)}</h2><p>Fresh from ${esc(product.farmer_name||"a local HarvestLink farmer")}, carefully grown and picked at its best.</p><p class="product-detail-price">${money(product.price)} <small>/ ${esc(product.unit||"kg")}</small></p><p class="product-stock ${out?"out-of-stock":""}">${out?"Out of stock":`${stock} available`}</p><div class="product-detail-purchase"><label for="detail-quantity">Quantity</label><input id="detail-quantity" type="number" min="1" max="${stock}" value="1" ${out?"disabled":""}><button class="button button-primary" id="detail-add" ${out?"disabled":""}>${out?"Out of stock":"Add to cart"} <span>+</span></button></div>`;
  $("#product-modal").showModal();$("#detail-add").onclick=()=>{addToCart(key,$("#detail-quantity").value);$("#product-modal").close();};
}

document.addEventListener("click",event=>{
  const add=event.target.closest("[data-add]");if(add){event.stopPropagation();const quantity=$(`[data-product-qty="${CSS.escape(add.dataset.add)}"]`);addToCart(add.dataset.add,quantity?.value||1);return;}
  const change=event.target.closest("[data-qty]");if(change){const key=change.dataset.qty,product=findProduct(key);updateCartQuantity(key,(state.cart[key]||0)+Number(change.dataset.delta));if(Number(change.dataset.delta)<0&&!(state.cart[key]))notify(`${product?.name||"Item"} removed from cart`);return;}
  const remove=event.target.closest("[data-remove]");if(remove){const product=findProduct(remove.dataset.remove);delete state.cart[remove.dataset.remove];persistCart();renderCart();notify(`${product?.name||"Item"} removed from cart`);return;}
  const card=event.target.closest("[data-product]");if(card&&!event.target.closest("button,input,select,a"))showProduct(card.dataset.product);
  const close=event.target.closest("[data-close]");if(close)close.closest("dialog").close();
});

document.querySelectorAll(".filter-chip").forEach(button=>button.addEventListener("click",()=>{state.category=button.dataset.category;document.querySelectorAll(".filter-chip").forEach(chip=>chip.classList.toggle("active",chip===button));renderProducts();}));
$("#search-input").addEventListener("input",event=>{state.query=event.target.value;renderProducts();});
$("#cart-button").onclick=()=>{renderCart();$("#cart-modal").showModal();};
$("#checkout-button").onclick=openCheckout;
$("#checkout-form").addEventListener("submit",placeOrder);
$("#account-button").onclick=async()=>{if(!state.user){openAuth("login");return;}try{const {error}=await state.client.auth.signOut();if(error)throw error;state.user=null;state.profile=null;syncAccount();syncDashboard();notify("Signed out");}catch(error){notify(authMessage(error));}};
$("#auth-form").addEventListener("submit",authSubmit);
document.querySelectorAll(".auth-tab").forEach(button=>button.onclick=()=>{state.mode=button.dataset.mode;syncAuth();});
$("#join-button").onclick=()=>$("#farmer-modal").showModal();
$("#farmer-signup").onclick=()=>{$("#farmer-modal").close();openAuth("register");};
$("#menu-toggle").onclick=()=>{const open=$("#main-nav").classList.toggle("open");$("#menu-toggle").setAttribute("aria-expanded",String(open));};
document.querySelectorAll(".main-nav a").forEach(link=>link.onclick=()=>{$("#main-nav").classList.remove("open");$("#menu-toggle").setAttribute("aria-expanded","false");});

renderProducts();persistCart();syncAccount();syncDashboard();syncAuth();
$("#dashboard-button").onclick=()=>{if(!state.user){openAuth("login");return;}if(state.profile?.role==="buyer"){location.hash="#catalogue";notify("Your shop is ready");return;}loadDashboard();};
if(window.supabase&&SUPABASE_CONFIGURED){
  state.products=[];renderProducts();state.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  state.client.auth.getSession().then(async({data,error})=>{if(error){notify(authMessage(error));return;}state.user=data.session?.user||null;if(state.user){try{await refreshProfile();await restoreAndMergeCart();}catch(profileError){notify(authMessage(profileError));}}syncAccount();syncDashboard();});
  state.client.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;if(!state.user)state.profile=null;setTimeout(async()=>{try{if(state.user)await refreshProfile();}catch(error){notify(authMessage(error));}syncAccount();syncDashboard();},0);});
  loadProducts();$("#auth-hint").textContent="";
}else if(!SUPABASE_CONFIGURED){console.info("HarvestLink demo mode: Supabase credentials are missing.");}
else{state.products=[];renderProducts();$("#catalog-message").textContent="Supabase is configured but its client library did not load. Check your connection and refresh.";console.error("Supabase client library is unavailable.");}
document.addEventListener("scroll",()=>document.querySelector(".site-header").classList.toggle("scrolled",window.scrollY>12),{passive:true});
