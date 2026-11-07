const API = "https://applaud.yyl125.cc";
const key = location.pathname.replace(/\/$/, '');

// 使用 querySelector 选择 class 元素
const btn = document.querySelector(".applaudBtn");
const countEl = btn.querySelector(".likeCount");
const iconEl = btn.querySelector("i");

let animFrame = null;

// 加载点赞数
async function loadLikes() {
  const res = await fetch(`${API}?key=${key}`);
  const data = await res.json();
  countEl.textContent = data.count;
}

// 初次加载
loadLikes();

// 每 10 秒刷新
setInterval(loadLikes, 10000);

// 本地防重复点赞
if (localStorage.getItem("liked_" + key)) {
  btn.disabled = true;
  btn.style.opacity = 0.7;
  iconEl.classList.replace("ri-thumb-up-line", "ri-thumb-up-fill");
  btn.classList.add("liked");
}

btn.addEventListener("click", async () => {
  if (btn.disabled) return;

  // 按钮微弹跳
  btn.style.transform = "scale(1.2)";
  setTimeout(() => btn.style.transform = "scale(1)", 200);

  // 图标弹跳
  btn.classList.add("animate");
  setTimeout(() => btn.classList.remove("animate"), 400);

  // 发请求点赞
  const res = await fetch(`${API}?key=${key}`, { method: "POST" });
  const data = await res.json();
  const start = parseInt(countEl.textContent, 10);
  const end = data.count;

  // 图标切换空心 → 实心
  iconEl.classList.replace("ri-thumb-up-line", "ri-thumb-up-fill");
  btn.classList.add("liked");

  // requestAnimationFrame 数字递增
  const duration = 400;
  const startTime = performance.now();
  cancelAnimationFrame(animFrame);

  function animateNumber(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.round(start + (end - start) * progress);
    countEl.textContent = value;
    countEl.classList.add("animate");

    if (progress < 1) {
      animFrame = requestAnimationFrame(animateNumber);
    } else {
      countEl.classList.remove("animate");
    }
  }

  animFrame = requestAnimationFrame(animateNumber);

  // 本地防重复
  localStorage.setItem("liked_" + key, "1");
  btn.disabled = true;
  btn.style.opacity = 0.7;
});