/**
 * 휴대폰에서 지도가 화면을 거의 다 차지하면, 손가락이 지도에 닿는 순간 쪽 스크롤이 멈춘다.
 *
 * 2026-11-15 까지는 "한 손가락은 쪽 스크롤, 두 손가락은 지도"(구글 지도의 cooperative gestures)였다.
 * 그런데 카카오맵 SDK 는 끌기를 꺼도 안쪽 층에서 터치를 가로채(touch-action: none) 한 손가락 스크롤이
 * 실제로는 되지 않았다. 그래서 지도 위에 투명한 덮개를 올려 두는 "잠금" 방식으로 바꿨다
 * (부동산·배달 지도들이 쓰는 "지도를 움직이려면 누르세요"와 같다).
 *
 *  - 잠금(처음 상태): 덮개가 터치를 받는다. 덮개는 touch-action: pan-y 라 쪽이 그대로 스크롤된다.
 *  - 지도를 한 번 누르면 풀린다. 누른 자리에 핀·확대 단추가 있으면 그 누름도 그대로 전한다.
 *    두 손가락을 대도 풀린다(벌려서 확대하던 버릇 그대로).
 *  - 풀린 동안에는 지도를 끌고 확대한다. 지도 밖을 만지거나, "지도 잠그기"를 누르거나,
 *    지도가 화면 밖으로 나가면 다시 잠긴다.
 *
 * 켜는 조건: 터치 화면(pointer: coarse). 마우스에서는 아무 일도 하지 않는다.
 */
export function cooperativeTouch(el: HTMLElement, setDrag: (on: boolean) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return () => {};

  // 카카오·네이버 엔진은 지도 칸을 relative 틀이 감싸고 있다. 덮개를 그 틀에(지도 칸의 형제로) 올려야
  // 덮개의 터치가 지도 SDK 로 번지지 않는다. Leaflet 은 틀이 없어 지도 칸 안에 올린다.
  const wrap = el.parentElement;
  const host = wrap && wrap.classList.contains("isolate") && getComputedStyle(wrap).position !== "static" ? wrap : el;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";

  const pill = "position:absolute;left:50%;transform:translateX(-50%);padding:9px 15px;border-radius:999px;" +
    "font-size:13.5px;font-weight:700;white-space:nowrap;box-shadow:0 2px 10px rgba(17,20,28,.18);";

  const cover = document.createElement("div");
  cover.setAttribute("role", "button");
  cover.setAttribute("aria-label", "지도를 움직이려면 누르세요");
  cover.style.cssText = "position:absolute;inset:0;z-index:1100;touch-action:pan-y;background:transparent;-webkit-tap-highlight-color:transparent;";
  const tip = document.createElement("span");
  tip.textContent = "지도를 움직이려면 한 번 누르세요";
  tip.style.cssText = pill + "bottom:14px;background:rgba(17,20,28,.82);color:#fff;pointer-events:none;";
  cover.appendChild(tip);

  const lockBtn = document.createElement("button");
  lockBtn.type = "button";
  lockBtn.textContent = "지도 잠그기 · 화면 스크롤";
  lockBtn.style.cssText = pill + "top:10px;z-index:1100;background:#fff;color:#111827;border:1px solid rgba(17,20,28,.14);display:none;";

  let locked = true;
  const prevTouchAction = el.style.touchAction;
  const lock = () => {
    locked = true;
    setDrag(false);
    el.style.touchAction = "pan-y";
    cover.style.display = "block";
    lockBtn.style.display = "none";
  };
  const unlock = () => {
    locked = false;
    setDrag(true);
    el.style.touchAction = prevTouchAction;
    cover.style.display = "none";
    lockBtn.style.display = "block";
  };

  // 누르면 풀고, 누른 자리 아래에 있던 것(핀·확대 단추)에 그 누름을 그대로 전한다.
  const onTap = (e: MouseEvent) => {
    unlock();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (under instanceof HTMLElement && under !== cover && el.contains(under)) under.click();
  };
  const onCoverTouch = (e: TouchEvent) => { if (e.touches.length >= 2) unlock(); };
  const onLockBtn = (e: MouseEvent) => { e.stopPropagation(); lock(); };
  // 풀린 채로 지도 밖을 만지면 쪽을 넘기려는 것이다. 다시 잠근다.
  const onOutside = (e: TouchEvent) => { if (!locked && e.target instanceof Node && !host.contains(e.target)) lock(); };

  cover.addEventListener("click", onTap);
  cover.addEventListener("touchstart", onCoverTouch, { passive: true });
  lockBtn.addEventListener("click", onLockBtn);
  document.addEventListener("touchstart", onOutside, { passive: true });

  // 지도가 화면에서 거의 사라지면 잠근다. 다시 돌아왔을 때 스크롤이 지도에 걸리지 않게.
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((es) => { if (!locked && es.some((x) => x.intersectionRatio < 0.25)) lock(); }, { threshold: [0, 0.25] });
    io.observe(host);
  }

  host.appendChild(cover);
  host.appendChild(lockBtn);
  lock();

  return () => {
    io?.disconnect();
    document.removeEventListener("touchstart", onOutside);
    cover.remove();
    lockBtn.remove();
    el.style.touchAction = prevTouchAction;
  };
}
