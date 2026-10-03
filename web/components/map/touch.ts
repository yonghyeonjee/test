/**
 * 휴대폰에서 지도가 화면을 거의 다 차지하면, 손가락으로 끌 때 지도만 움직이고
 * 쪽은 안 내려간다. 한 손가락은 쪽 스크롤에, 두 손가락은 지도에 준다
 * (구글 지도의 cooperative gestures 와 같은 방식).
 *
 * 켜는 조건: 터치 화면(pointer: coarse). 마우스에서는 아무 일도 하지 않는다.
 * 한 손가락으로 끌려고 하면 "두 손가락으로 움직이세요" 안내를 잠깐 띄운다.
 */
export function cooperativeTouch(el: HTMLElement, setDrag: (on: boolean) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return () => {};
  let hint: HTMLDivElement | null = null;
  let timer = 0;
  let startY = 0, moved = false;
  const show = () => {
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "pm-hint";
      hint.textContent = "두 손가락으로 지도를 움직이세요";
      el.appendChild(hint);
    }
    hint.classList.add("on");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => hint?.classList.remove("on"), 1200);
  };
  const start = (e: TouchEvent) => {
    const two = e.touches.length >= 2;
    setDrag(two);
    if (two) { hint?.classList.remove("on"); return; }
    startY = e.touches[0].clientY; moved = false;
  };
  const move = (e: TouchEvent) => {
    if (e.touches.length >= 2) { setDrag(true); hint?.classList.remove("on"); return; }
    if (!moved && Math.abs(e.touches[0].clientY - startY) > 12) { moved = true; show(); }
  };
  const end = (e: TouchEvent) => { if (e.touches.length < 2) setDrag(false); };
  setDrag(false);
  el.style.touchAction = "pan-y";
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchmove", move, { passive: true });
  el.addEventListener("touchend", end, { passive: true });
  el.addEventListener("touchcancel", end, { passive: true });
  return () => {
    window.clearTimeout(timer);
    el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move);
    el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end);
    hint?.remove();
  };
}
