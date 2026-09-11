/** 화면이 바뀔 때 살짝 떠오른다. 새 화면임을 알리는 정도로만, 240ms. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
