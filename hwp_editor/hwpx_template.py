"""문단 글 목록만으로 한글이 열 수 있는 가장 단순한 HWPX 를 만든다.

HWP 를 고친 결과를 내려 줄 때 쓴다. 서식·표·그림은 담지 않고 글만, 문단마다 ``<hp:p>`` 하나.
바탕글(함초롬바탕 10pt, 줄간격 160%, A4) 한 가지 스타일만 정의한다.
"""
from __future__ import annotations

import io
import zipfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

from .hwpx_doc import HP, NAMESPACES, fill_t

MIMETYPE = b"application/hwp+zip"

VERSION_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" '
    'major="5" minor="0" micro="5" buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul" '
    'appVersion="12, 0, 0, 1"/>'
)

MANIFEST_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">\n'
    '  <odf:file-entry odf:full-path="/" odf:media-type="application/hwp+zip"/>\n'
    '  <odf:file-entry odf:full-path="Contents/header.xml" odf:media-type="application/xml"/>\n'
    '  <odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/>\n'
    '  <odf:file-entry odf:full-path="settings.xml" odf:media-type="application/xml"/>\n'
    '</odf:manifest>'
)

# rootfile 의 속성은 접두사 없이 써야 한다. ocf:full-path 처럼 쓰면 한글 2020(11.0.0.1623) 이 열다가 죽는다.
CONTAINER_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" '
    'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">\n'
    '  <ocf:rootfiles>\n'
    '    <ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>\n'
    '  </ocf:rootfiles>\n'
    '</ocf:container>'
)

SETTINGS_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" '
    'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">\n'
    '  <ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>\n'
    '</ha:HWPApplicationSetting>'
)


def content_hpf(title: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id="">\n'
        '  <opf:metadata>\n'
        f'    <opf:title>{escape(title)}</opf:title>\n'
        '    <opf:language>ko</opf:language>\n'
        '    <opf:meta name="creator" content="text"/>\n'
        '  </opf:metadata>\n'
        '  <opf:manifest>\n'
        '    <opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>\n'
        '    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>\n'
        '    <opf:item id="settings" href="settings.xml" media-type="application/xml"/>\n'
        '  </opf:manifest>\n'
        '  <opf:spine>\n'
        '    <opf:itemref idref="header" linear="yes"/>\n'
        '    <opf:itemref idref="section0" linear="yes"/>\n'
        '  </opf:spine>\n'
        '</opf:package>'
    )


def _fontfaces() -> str:
    langs = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"]
    inner = "".join(
        f'<hh:fontface lang="{lang}" fontCnt="1"><hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"/></hh:fontface>'
        for lang in langs
    )
    return f'<hh:fontfaces itemCnt="{len(langs)}">{inner}</hh:fontfaces>'


def _border(name: str) -> str:
    return f'<hh:{name} type="NONE" width="0.1 mm" color="#000000"/>'


HEADER_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    f'<hh:head xmlns:hh="{NAMESPACES["hh"]}" xmlns:hp="{NAMESPACES["hp"]}" xmlns:hc="{NAMESPACES["hc"]}" '
    'version="1.4" secCnt="1">'
    '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>'
    '<hh:refList>'
    + _fontfaces() +
    '<hh:borderFills itemCnt="2">'
    + "".join(
        f'<hh:borderFill id="{i}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
        '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
        + _border("leftBorder") + _border("rightBorder") + _border("topBorder") + _border("bottomBorder") +
        '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>'
        '</hh:borderFill>'
        for i in (1, 2)
    ) +
    '</hh:borderFills>'
    '<hh:charProperties itemCnt="1">'
    '<hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" '
    'symMark="NONE" borderFillIDRef="2">'
    '<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
    '<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>'
    '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
    '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>'
    '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
    '<hh:underline type="NONE" shape="SOLID" color="#000000"/>'
    '<hh:strikeout shape="NONE" color="#000000"/>'
    '<hh:outline type="NONE"/>'
    '<hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/>'
    '</hh:charPr>'
    '</hh:charProperties>'
    '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>'
    '<hh:numberings itemCnt="1"><hh:numbering id="1" start="0">'
    + "".join(
        f'<hh:paraHead start="1" level="{lv}" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" '
        f'textOffsetType="PERCENT" textOffset="50" numFormat="DIGIT" charPrIDRef="4294967295" checkable="0">^{lv}.</hh:paraHead>'
        for lv in range(1, 8)
    ) +
    '</hh:numbering></hh:numberings>'
    '<hh:paraProperties itemCnt="1">'
    '<hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">'
    '<hh:align horizontal="JUSTIFY" vertical="BASELINE"/>'
    '<hh:heading type="NONE" idRef="0" level="0"/>'
    '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" '
    'keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
    '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
    '<hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/>'
    '<hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin>'
    '<hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>'
    '<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>'
    '</hh:paraPr>'
    '</hh:paraProperties>'
    '<hh:styles itemCnt="1">'
    '<hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" '
    'langID="1042" lockForm="0"/>'
    '</hh:styles>'
    '</hh:refList>'
    '<hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>'
    '<hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption>'
    '</hh:head>'
)

# 첫 문단의 첫 run 에 들어가는 구역 설정(A4 세로, 여백 기본값) 과 단 설정.
SECTION_PR = (
    '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" '
    'tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">'
    '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0" strictXMLFormat="0"/>'
    '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>'
    '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" '
    'hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>'
    '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>'
    '<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">'
    '<hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>'
    '</hp:pagePr>'
    '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>'
    '<hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>'
    '<hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>'
    '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>'
    '<hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>'
    '<hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>'
    + "".join(
        f'<hp:pageBorderFill type="{kind}" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER">'
        '<hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>'
        for kind in ("BOTH", "EVEN", "ODD")
    ) +
    '</hp:secPr>'
    '<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>'
)


def section_xml(texts: list[str]) -> bytes:
    """문단 글 목록 → section0.xml. 빈 목록이면 빈 문단 하나."""
    texts = list(texts) or [""]
    root = ET.Element("{%s}sec" % NAMESPACES["hs"])
    for i, text in enumerate(texts):
        p = ET.SubElement(root, HP + "p", {
            "id": str(i), "paraPrIDRef": "0", "styleIDRef": "0", "pageBreak": "0", "columnBreak": "0", "merged": "0",
        })
        if i == 0:
            first = ET.fromstring(f'<hp:run xmlns:hp="{NAMESPACES["hp"]}" charPrIDRef="0">{SECTION_PR}</hp:run>')
            p.append(first)
        run = ET.SubElement(p, HP + "run", {"charPrIDRef": "0"})
        fill_t(ET.SubElement(run, HP + "t"), text)
    from .hwpx_doc import serialize
    return serialize(root)


def build_hwpx(texts: list[str], title: str = "") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        mt = zipfile.ZipInfo("mimetype")
        mt.compress_type = zipfile.ZIP_STORED
        z.writestr(mt, MIMETYPE)
        for name, body in (
            ("version.xml", VERSION_XML),
            ("META-INF/manifest.xml", MANIFEST_XML),
            ("META-INF/container.xml", CONTAINER_XML),
            ("Contents/content.hpf", content_hpf(title)),
            ("Contents/header.xml", HEADER_XML),
            ("Contents/section0.xml", section_xml(texts)),
            ("settings.xml", SETTINGS_XML),
        ):
            z.writestr(name, body.encode("utf-8") if isinstance(body, str) else body, zipfile.ZIP_DEFLATED)
    return buf.getvalue()
