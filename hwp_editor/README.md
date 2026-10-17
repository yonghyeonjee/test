# HWP·HWPX 편집기 (내 컴퓨터에서 돌리는 로컬 웹 프로그램)

한글 문서(`.hwp`, `.hwpx`) 를 브라우저에 올려 문단 글을 고치고 다시 내려받는다.
파일은 내 컴퓨터 안의 작은 서버(`127.0.0.1`) 로만 가고 바깥으로 나가지 않는다.

| 형식 | 열기 | 고치기 | 저장 |
|---|---|---|---|
| **HWPX** (한글 2014+ 의 XML 묶음) | ○ | 문단 글 고치기·문단 더하기·지우기·찾아 바꾸기 | **HWPX 그대로** — 글꼴·표·그림·쪽 설정은 손대지 않고 글만 바꿔 다시 묶는다 |
| **HWP 5.0** (한글 2002+ 이진) | ○ 글 읽기 | 위와 같음 | HWPX(글만 담은 새 문서) 또는 txt — HWP 이진 형식으로 되돌려 쓰지는 못한다 |

HWP 는 압축된 이진 레코드라 글만 바꿔 제자리에 다시 쓸 수 없다(레코드 길이·압축 스트림이 다 바뀜).
암호 문서, 배포용(ViewText) 문서, 한글 97 이하 `.hwp` 는 열지 못한다.

## 준비 (한 번만)

Python 3.10 이상이 필요하다. https://www.python.org/downloads/ 에서 설치할 때 **"Add python.exe to PATH"** 를 켠다.

```bat
pip install olefile
```

(저장소 전체 `requirements.txt` 를 설치했다면 이미 들어 있다. HWPX 만 쓸 거면 아무것도 설치하지 않아도 된다.)

## 켜기

저장소 루트에서:

```bat
hwp_editor\run.bat          :: Windows
sh hwp_editor/run.sh        # macOS·Linux
python -m hwp_editor        # 아무 곳에서나, 저장소 루트에서
```

브라우저가 `http://127.0.0.1:8765/` 로 열린다. 끄려면 터미널에서 `Ctrl+C`.
포트가 겹치면 `python -m hwp_editor --port 9000`, 브라우저를 직접 열려면 `--no-browser`.

## 쓰는 법

1. 파일을 끌어다 놓거나 눌러서 고른다.
2. 문단마다 칸이 하나씩 나온다. 바로 고친다. 표 안 문단은 들여쓰기와 **표 안** 표시가 붙는다.
3. 문단 오른쪽 **＋** (또는 칸 안에서 `Ctrl+Enter`) 로 아래에 문단을 더하고, **✕** 로 지운다.
   표·그림·구역 설정을 품은 문단(**개체** 표시)과 표 칸의 하나뿐인 문단은 지울 수 없다(글은 고칠 수 있다).
4. 위쪽 찾기 칸으로 **다음 찾기** / **모두 바꾸기**.
5. **저장(내려받기)** (`Ctrl+S`) → 브라우저 다운로드 폴더에 같은 이름의 `.hwpx`(또는 `.txt`) 가 떨어진다.
   원본 파일은 건드리지 않는다.

칸 안의 `Enter` 는 문단 안 줄바꿈(한글의 `Shift+Enter`) 으로 저장된다. 글의 서식은 그 문단 첫 글자 서식을 따른다
(한 문단에 굵은 글과 보통 글이 섞여 있었다면 고친 뒤에는 첫 run 의 서식으로 통일된다).

## 구조

```
hwp_editor/
  app.py            로컬 HTTP 서버(표준 라이브러리) · /api/open /api/save
  hwpx_doc.py       HWPX 열기·문단 고치기·다시 묶기 (xml.etree + zipfile)
  hwp_doc.py        HWP 5.0 읽기 (olefile + zlib, 레코드 파서)
  hwpx_template.py  글만으로 가장 단순한 HWPX 만들기 (HWP → HWPX 내려받기에 쓴다)
  static/index.html 화면 (바닐라 JS, 바깥 자원 없음)
  test_hwp_editor.py
```

검사: `python hwp_editor/test_hwp_editor.py`
