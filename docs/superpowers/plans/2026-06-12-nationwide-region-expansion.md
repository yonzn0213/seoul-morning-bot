# 전국 시/군/구 지역 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서울 25개 구만 지원하던 봇을 전국 17개 시/도 → 각 시/군/구(약 250개) 2단계 선택으로 확장한다.

**Architecture:** 시군구별 격자좌표를 정적 파일 `regions.json`으로 번들한다. 좌표는 시군구 중심 위경도를 기상청 LCC 변환 공식으로 격자(nx, ny)로 환산해 생성한다(`tools/build_regions.py`). 텔레그램은 시/도 → 시군구 2단계 인라인 키보드를 쓰고 callback_data는 인덱스로 인코딩한다. 미세먼지는 시/도별로 에어코리아를 호출·캐싱해 시군구 측정소 매칭 후 없으면 시/도 평균으로 대체한다.

**Tech Stack:** Python 3, `requests`, GitHub Actions. 테스트는 `pytest`(로컬 개발 의존성).

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|------|------|-----------|
| `regions.json` | 시/도 → 시군구 → {nx, ny} + airkorea sidoName | 신규(생성물) |
| `tools/build_regions.py` | 위경도 CSV → regions.json 생성·검증, LCC 변환 | 신규 |
| `tools/sigungu_latlon.csv` | 입력: `sido,sigungu,lat,lon` (시군구 중심 위경도) | 신규(데이터) |
| `common.py` | regions 로드, 키보드 생성, 콜백 인덱스 인코딩/디코딩 | 수정 |
| `register.py` | 2단계 콜백 흐름(시도→시군구→저장, 뒤로) | 수정 |
| `briefing.py` | 시/도별 dust 캐싱, dust_for 시그니처, 메시지 | 수정 |
| `tests/test_grid.py` | LCC 변환 정확성(앵커) | 신규 |
| `tests/test_regions.py` | regions.json 스키마/좌표 범위 검증 | 신규 |
| `tests/test_keyboard.py` | 키보드 생성 + 콜백 라운드트립 | 신규 |
| `tests/test_dust.py` | dust_for 매칭/평균 fallback | 신규 |
| `README.md` | "서울" → "전국", 2단계 안내 | 수정 |

**인터페이스 계약 (모든 태스크 공유)**
- `regions.json` 구조: `{ "<시도>": { "airkorea": "<sidoName>", "sigungu": { "<시군구>": {"nx": int, "ny": int} } } }`
- `common.load_regions() -> dict` — 위 구조 반환
- `common.REGIONS` — 모듈 로드시 `load_regions()` 결과 (시도 삽입 순서 = 인덱스 기준)
- `common.SIDO_LIST: list[str]` — `list(REGIONS.keys())`
- `common.sigungu_names(sido: str) -> list[str]`
- `common.sido_keyboard() -> dict` — 버튼 callback_data `f"s:{i}"`
- `common.sigungu_keyboard(sido_idx: int) -> dict` — 버튼 `f"r:{sido_idx}:{j}"` + 뒤로 `"s:back"`
- `common.resolve_region(sido_idx: int, sigungu_idx: int) -> tuple[str, str]` — `(sido, sigungu)`, 범위 밖이면 `IndexError`
- `briefing.fetch_dust(sido_name: str) -> dict` — `{"stations": {...}, "avg": {...}}`
- `briefing.dust_for(sigungu: str, dust: dict) -> tuple[dict, bool]`
- 유저 상태: `{"sido": str, "sigungu": str, "name": str}`

---

## Task 0: 개발 환경 준비

**Files:**
- Create: `tests/__init__.py` (빈 파일)

- [ ] **Step 1: pytest 설치**

Run: `pip install pytest`
Expected: `Successfully installed pytest-...`

- [ ] **Step 2: 테스트 디렉터리 생성**

`tests/__init__.py`를 빈 파일로 생성한다.

- [ ] **Step 3: 커밋**

```bash
git add tests/__init__.py
git commit -m "test: pytest 테스트 디렉터리 추가"
```

---

## Task 1: 격자 변환 + regions.json 생성

기상청 LCC 변환 공식을 검증된 코드로 두고, 시군구 중심 위경도 CSV를 격자로 환산해 `regions.json`을 만든다.

**데이터 입력 `tools/sigungu_latlon.csv`**: `sido,sigungu,lat,lon` 헤더. 전국 17개 시/도 모든 시군구의 중심 위경도. 공개 행정구역 중심좌표 데이터에서 확보하며, 아래 검증(Step 6)을 반드시 통과해야 한다. (광역시 자치구, 도의 시/군 포함. 세종특별자치시는 시군구가 없으므로 자기 자신 1개로 둔다.)

**Files:**
- Create: `tools/build_regions.py`
- Create: `tools/sigungu_latlon.csv`
- Create: `tests/test_grid.py`
- Create: `regions.json` (생성물)

- [ ] **Step 1: 변환 함수 실패 테스트 작성**

`tests/test_grid.py`:
```python
"""기상청 LCC 위경도→격자 변환 검증"""
from tools.build_regions import latlon_to_grid


def test_서울시청_격자():
    # 서울시청 (37.5665, 126.9780) -> 기상청 격자 (60, 127)
    assert latlon_to_grid(37.5665, 126.9780) == (60, 127)


def test_부산시청_격자():
    # 부산시청 (35.1798, 129.0750) -> (98, 76)
    assert latlon_to_grid(35.1798, 129.0750) == (98, 76)


def test_강남구_격자():
    # 강남구청 (37.5172, 127.0473) -> 기존 common.py 값 (61, 126)
    assert latlon_to_grid(37.5172, 127.0473) == (61, 126)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `python -m pytest tests/test_grid.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tools.build_regions'`

- [ ] **Step 3: 변환 함수 구현**

`tools/build_regions.py`:
```python
"""시군구 중심 위경도 CSV -> regions.json 생성 + 검증.

격자 변환은 기상청 단기예보 LCC 투영 공식을 사용한다.
출처 상수: 기상청 단기예보 조회서비스 활용가이드.
"""
import csv
import json
import math
import sys
from pathlib import Path

# 기상청 LCC 투영 상수
RE = 6371.00877   # 지구 반경(km)
GRID = 5.0        # 격자 간격(km)
SLAT1 = 30.0      # 투영 위도1
SLAT2 = 60.0      # 투영 위도2
OLON = 126.0      # 기준점 경도
OLAT = 38.0       # 기준점 위도
XO = 43           # 기준점 X좌표
YO = 136          # 기준점 Y좌표


def latlon_to_grid(lat: float, lon: float) -> tuple[int, int]:
    DEGRAD = math.pi / 180.0
    re = RE / GRID
    slat1 = SLAT1 * DEGRAD
    slat2 = SLAT2 * DEGRAD
    olon = OLON * DEGRAD
    olat = OLAT * DEGRAD

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = sf ** sn * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / ro ** sn

    ra = math.tan(math.pi * 0.25 + lat * DEGRAD * 0.5)
    ra = re * sf / ra ** sn
    theta = lon * DEGRAD - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    nx = int(math.floor(ra * math.sin(theta) + XO + 0.5))
    ny = int(math.floor(ro - ra * math.cos(theta) + YO + 0.5))
    return nx, ny
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `python -m pytest tests/test_grid.py -v`
Expected: PASS (3 passed). 만약 부산 등 앵커가 1격자 차이로 어긋나면, 해당 청사의 정확한 위경도로 테스트 기대값을 조정(±1격자는 청사 좌표 출처 차이일 수 있음 — 단 서울시청·강남구는 반드시 일치해야 함).

- [ ] **Step 5: airkorea 매핑 + 빌드 로직 추가**

`tools/build_regions.py`에 이어서:
```python
# 시도 표시명 -> 에어코리아 sidoName
AIRKOREA_SIDO = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구",
    "인천광역시": "인천", "광주광역시": "광주", "대전광역시": "대전",
    "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기",
    "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전북특별자치도": "전북", "전라남도": "전남", "경상북도": "경북",
    "경상남도": "경남", "제주특별자치도": "제주",
}

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = Path(__file__).resolve().parent / "sigungu_latlon.csv"
OUT_PATH = ROOT / "regions.json"


def build() -> dict:
    regions: dict = {}
    with CSV_PATH.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sido = row["sido"].strip()
            sigungu = row["sigungu"].strip()
            nx, ny = latlon_to_grid(float(row["lat"]), float(row["lon"]))
            if sido not in regions:
                if sido not in AIRKOREA_SIDO:
                    raise ValueError(f"알 수 없는 시도: {sido}")
                regions[sido] = {"airkorea": AIRKOREA_SIDO[sido], "sigungu": {}}
            regions[sido]["sigungu"][sigungu] = {"nx": nx, "ny": ny}
    return regions


def validate(regions: dict):
    assert len(regions) == 17, f"시도 17개여야 함, 실제 {len(regions)}"
    for sido, blk in regions.items():
        assert blk["airkorea"] in AIRKOREA_SIDO.values(), f"{sido} airkorea 이상"
        assert blk["sigungu"], f"{sido} 시군구 비어있음"
        for sg, g in blk["sigungu"].items():
            assert 1 <= g["nx"] <= 150, f"{sido} {sg} nx 범위 밖: {g['nx']}"
            assert 1 <= g["ny"] <= 255, f"{sido} {sg} ny 범위 밖: {g['ny']}"


def main():
    regions = build()
    validate(regions)
    OUT_PATH.write_text(
        json.dumps(regions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    total = sum(len(b["sigungu"]) for b in regions.values())
    print(f"regions.json 생성: 시도 {len(regions)}개, 시군구 {total}개")


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: 입력 CSV 확보 + regions.json 생성·검증**

1. `tools/sigungu_latlon.csv`를 `sido,sigungu,lat,lon` 형식으로 채운다 (전국 시군구 중심 위경도).
2. Run: `python tools/build_regions.py`
3. Expected: `regions.json 생성: 시도 17개, 시군구 NNN개` (NNN은 230~260 사이). 에러나 AssertionError가 나면 CSV를 수정해 재실행.
4. 육안 검증: `regions.json`에서 `서울특별시 > sigungu > 종로구`가 `{"nx": 60, "ny": 127}`, `강남구`가 `{"nx": 61, "ny": 126}`인지 확인 (기존 common.py 값과 일치해야 함).

- [ ] **Step 7: 커밋**

```bash
git add tools/build_regions.py tools/sigungu_latlon.csv tests/test_grid.py regions.json
git commit -m "feat: 전국 시군구 격자좌표 regions.json 생성 도구"
```

---

## Task 2: common.py — regions 로드

**Files:**
- Modify: `common.py:16-28` (REGIONS dict 제거), `common.py:1-14` (로드 추가)
- Create: `tests/test_regions.py`

- [ ] **Step 1: regions.json 스키마 실패 테스트 작성**

`tests/test_regions.py`:
```python
"""regions.json 스키마/좌표 검증 (런타임 무관)"""
import os

os.environ.setdefault("DATA_GO_KR_KEY", "test")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test")

from common import REGIONS, SIDO_LIST, sigungu_names


def test_시도_17개():
    assert len(REGIONS) == 17
    assert len(SIDO_LIST) == 17


def test_서울_강남구_좌표():
    assert REGIONS["서울특별시"]["sigungu"]["강남구"] == {"nx": 61, "ny": 126}


def test_모든_좌표_범위_정상():
    for sido, blk in REGIONS.items():
        assert blk["airkorea"]
        for sg, g in blk["sigungu"].items():
            assert 1 <= g["nx"] <= 150
            assert 1 <= g["ny"] <= 255


def test_sigungu_names_순서():
    names = sigungu_names("서울특별시")
    assert "강남구" in names
    assert names == list(REGIONS["서울특별시"]["sigungu"].keys())
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `python -m pytest tests/test_regions.py -v`
Expected: FAIL — `ImportError: cannot import name 'SIDO_LIST'`

- [ ] **Step 3: common.py 수정 — REGIONS 로드로 교체**

`common.py`에서 기존 `REGIONS = { ... }` 하드코딩 블록(16-28행)을 삭제하고, 상단을 아래로 교체한다.

기존:
```python
KST = timezone(timedelta(hours=9))
STATE_FILE = Path(__file__).parent / "state.json"

SERVICE_KEY = os.environ["DATA_GO_KR_KEY"]
BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]

# 서울 25개 구: 기상청 단기예보 격자좌표 (nx, ny)
# 에어코리아 서울 측정소 이름은 구 이름과 동일
REGIONS = {
    "종로구": (60, 127), "중구": (60, 127), ...
    "강동구": (62, 126),
}
```
교체 후:
```python
KST = timezone(timedelta(hours=9))
STATE_FILE = Path(__file__).parent / "state.json"
REGIONS_FILE = Path(__file__).parent / "regions.json"

SERVICE_KEY = os.environ["DATA_GO_KR_KEY"]
BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]


def load_regions() -> dict:
    return json.loads(REGIONS_FILE.read_text(encoding="utf-8"))


# 시도 -> {airkorea, sigungu:{name:{nx,ny}}}. 삽입 순서가 콜백 인덱스 기준.
REGIONS = load_regions()
SIDO_LIST = list(REGIONS.keys())


def sigungu_names(sido: str) -> list:
    return list(REGIONS[sido]["sigungu"].keys())
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `python -m pytest tests/test_regions.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: 커밋**

```bash
git add common.py tests/test_regions.py
git commit -m "feat: common.py에서 regions.json 로드"
```

---

## Task 3: common.py — 키보드 + 콜백 인코딩

기존 `region_keyboard()`(61-68행)를 시/도/시군구 2단계 키보드로 교체한다.

**Files:**
- Modify: `common.py:61-68`
- Create: `tests/test_keyboard.py`

- [ ] **Step 1: 키보드/콜백 실패 테스트 작성**

`tests/test_keyboard.py`:
```python
import os

os.environ.setdefault("DATA_GO_KR_KEY", "test")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test")

from common import (SIDO_LIST, sido_keyboard, sigungu_keyboard,
                    resolve_region, sigungu_names)


def test_시도_키보드_전체_포함():
    kb = sido_keyboard()
    buttons = [b for row in kb["inline_keyboard"] for b in row]
    assert len(buttons) == len(SIDO_LIST)
    assert buttons[0]["callback_data"] == "s:0"


def test_시군구_키보드_뒤로버튼_포함():
    kb = sigungu_keyboard(0)
    flat = [b for row in kb["inline_keyboard"] for b in row]
    assert any(b["callback_data"] == "s:back" for b in flat)
    first_sg = [b for b in flat if b["callback_data"].startswith("r:")][0]
    assert first_sg["callback_data"] == "r:0:0"


def test_콜백_라운드트립():
    sido = SIDO_LIST[1]
    sg = sigungu_names(sido)[0]
    assert resolve_region(1, 0) == (sido, sg)


def test_범위밖_인덱스는_에러():
    import pytest
    with pytest.raises(IndexError):
        resolve_region(999, 0)


def test_콜백_3열():
    kb = sido_keyboard()
    assert all(len(row) <= 3 for row in kb["inline_keyboard"])
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `python -m pytest tests/test_keyboard.py -v`
Expected: FAIL — `ImportError: cannot import name 'sido_keyboard'`

- [ ] **Step 3: 키보드/콜백 구현**

`common.py`의 기존 `region_keyboard()` 함수를 삭제하고 아래로 교체:
```python
def _rows(buttons: list, cols: int = 3) -> list:
    return [buttons[i:i + cols] for i in range(0, len(buttons), cols)]


def sido_keyboard() -> dict:
    buttons = [{"text": s, "callback_data": f"s:{i}"}
               for i, s in enumerate(SIDO_LIST)]
    return {"inline_keyboard": _rows(buttons)}


def sigungu_keyboard(sido_idx: int) -> dict:
    sido = SIDO_LIST[sido_idx]
    names = sigungu_names(sido)
    buttons = [{"text": n, "callback_data": f"r:{sido_idx}:{j}"}
               for j, n in enumerate(names)]
    rows = _rows(buttons)
    rows.append([{"text": "⬅ 뒤로", "callback_data": "s:back"}])
    return {"inline_keyboard": rows}


def resolve_region(sido_idx: int, sigungu_idx: int) -> tuple:
    sido = SIDO_LIST[sido_idx]          # 범위 밖이면 IndexError
    names = sigungu_names(sido)
    return sido, names[sigungu_idx]     # 범위 밖이면 IndexError
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `python -m pytest tests/test_keyboard.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
git add common.py tests/test_keyboard.py
git commit -m "feat: 시도/시군구 2단계 키보드 + 인덱스 콜백"
```

---

## Task 4: register.py — 2단계 등록 흐름

**Files:**
- Modify: `register.py` (전체 import + handle_message + handle_callback)

- [ ] **Step 1: import 및 안내문 수정**

`register.py:9-22`를 교체:
```python
from common import (load_state, save_state, send_message,
                    sido_keyboard, sigungu_keyboard, resolve_region, tg)

WELCOME = (
    "👋 안녕하세요! <b>전국 아침 브리핑 봇</b>이에요.\n"
    "매일 아침 7시, 선택하신 지역의 비 소식과 미세먼지를 알려드립니다.\n\n"
    "먼저 시/도를 선택해주세요 👇"
)

HELP = (
    "✅ 매일 아침 7시에 <b>{region}</b> 브리핑을 보내드리고 있어요.\n\n"
    "/region — 지역 변경\n"
    "/stop — 알림 해지"
)
```

- [ ] **Step 2: handle_message 수정 (시도 키보드 전송)**

`register.py`의 `handle_message`에서 `region_keyboard()` 호출을 `sido_keyboard()`로, 등록 유저 일반 메시지의 region 표기를 수정:
```python
def handle_message(state: dict, msg: dict):
    chat_id = str(msg["chat"]["id"])
    text = (msg.get("text") or "").strip()
    users = state["users"]

    if text == "/stop":
        if users.pop(chat_id, None):
            send_message(chat_id, "알림을 해지했어요. 다시 받고 싶으면 /start 를 보내주세요. 👋")
        else:
            send_message(chat_id, "등록된 알림이 없어요. /start 로 시작할 수 있어요.")
        return

    if text in ("/start", "/region") or chat_id not in users:
        send_message(chat_id, WELCOME if chat_id not in users else "변경할 시/도를 선택해주세요 👇",
                     reply_markup=sido_keyboard())
        return

    u = users[chat_id]
    send_message(chat_id, HELP.format(region=f"{u['sido']} {u['sigungu']}"))
```

- [ ] **Step 3: handle_callback 2단계로 교체**

`register.py`의 `handle_callback` 전체를 교체:
```python
def handle_callback(state: dict, cq: dict):
    data = cq.get("data", "")
    chat_id = str(cq["message"]["chat"]["id"])
    message_id = cq["message"]["message_id"]
    cq_id = cq["id"]

    # 뒤로: 시도 선택으로 복귀
    if data == "s:back":
        tg("answerCallbackQuery", {"callback_query_id": cq_id})
        tg("editMessageText", {
            "chat_id": chat_id, "message_id": message_id,
            "text": "시/도를 선택해주세요 👇", "parse_mode": "HTML",
            "reply_markup": sido_keyboard(),
        })
        return

    # 시도 선택 -> 시군구 키보드
    if data.startswith("s:"):
        try:
            sido_idx = int(data[2:])
            kb = sigungu_keyboard(sido_idx)
        except (ValueError, IndexError):
            tg("answerCallbackQuery", {"callback_query_id": cq_id, "text": "다시 시도해주세요."})
            return
        tg("answerCallbackQuery", {"callback_query_id": cq_id})
        tg("editMessageText", {
            "chat_id": chat_id, "message_id": message_id,
            "text": "세부 지역(시/군/구)을 선택해주세요 👇", "parse_mode": "HTML",
            "reply_markup": kb,
        })
        return

    # 시군구 선택 -> 저장
    if data.startswith("r:"):
        try:
            _, si, gi = data.split(":")
            sido, sigungu = resolve_region(int(si), int(gi))
        except (ValueError, IndexError):
            tg("answerCallbackQuery", {"callback_query_id": cq_id, "text": "알 수 없는 지역이에요."})
            return

        is_new = chat_id not in state["users"]
        state["users"][chat_id] = {
            "sido": sido, "sigungu": sigungu,
            "name": cq["from"].get("first_name", ""),
        }
        tg("answerCallbackQuery", {"callback_query_id": cq_id, "text": f"{sigungu} 설정 완료!"})
        tg("editMessageText", {
            "chat_id": chat_id, "message_id": message_id,
            "text": f"📍 <b>{sido} {sigungu}</b>로 설정했어요!", "parse_mode": "HTML",
        })
        if is_new:
            send_message(chat_id,
                         f"등록 완료! 내일 아침 7시부터 <b>{sigungu}</b> 브리핑을 보내드릴게요. 🌅\n"
                         "지역 변경은 /region, 해지는 /stop")
        else:
            send_message(chat_id, f"이제부터 <b>{sigungu}</b> 기준으로 알려드릴게요!")
        return

    tg("answerCallbackQuery", {"callback_query_id": cq_id})
```

- [ ] **Step 4: 구문/임포트 점검**

Run: `python -c "import os; os.environ['DATA_GO_KR_KEY']='t'; os.environ['TELEGRAM_BOT_TOKEN']='t'; import register; print('ok')"`
Expected: `ok` (import 에러 없음)

- [ ] **Step 5: 커밋**

```bash
git add register.py
git commit -m "feat: 시도-시군구 2단계 등록 흐름"
```

---

## Task 5: briefing.py — 시도별 미세먼지 + 메시지

**Files:**
- Modify: `briefing.py:10` (import), `briefing.py:60-96` (fetch_dust/dust_for), `briefing.py:135-166` (build_message), `briefing.py:169-209` (main)
- Create: `tests/test_dust.py`

- [ ] **Step 1: dust_for 실패 테스트 작성**

`tests/test_dust.py`:
```python
import os

os.environ.setdefault("DATA_GO_KR_KEY", "test")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test")

from briefing import dust_for

DUST = {
    "stations": {"강남구": {"pm10": 40.0, "pm25": 20.0}},
    "avg": {"pm10": 55, "pm25": 30},
}


def test_측정소_매칭되면_그_값():
    val, is_avg = dust_for("강남구", DUST)
    assert val == {"pm10": 40.0, "pm25": 20.0}
    assert is_avg is False


def test_매칭_안되면_시도평균():
    val, is_avg = dust_for("가평군", DUST)
    assert val == {"pm10": 55, "pm25": 30}
    assert is_avg is True
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `python -m pytest tests/test_dust.py -v`
Expected: FAIL — `ImportError` 또는 기존 `dust_for(region, dust)` 시그니처 불일치. (기존 `dust_for`는 인자 2개지만 동작이 같으므로 실제로는 PASS할 수 있음 → 그 경우 Step 3에서 시그니처/네이밍만 정리하고 진행)

- [ ] **Step 3: fetch_dust 파라미터화 + dust_for 정리**

`briefing.py`의 `fetch_dust_all()`(60-88행)을 `fetch_dust(sido_name)`로 교체:
```python
def fetch_dust(sido_name: str) -> dict:
    """해당 시/도 전 측정소를 한 번에 가져와 측정소명 -> 측정값 매핑"""
    url = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty"
    params = {
        "serviceKey": SERVICE_KEY, "returnType": "json",
        "numOfRows": 1000, "pageNo": 1, "sidoName": sido_name, "ver": "1.0",
    }
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    items = r.json()["response"]["body"]["items"]

    by_station, pm10s, pm25s = {}, [], []
    for it in items:
        entry = {}
        for key, bucket in (("pm10Value", pm10s), ("pm25Value", pm25s)):
            try:
                v = float(it[key])
                entry["pm10" if key.startswith("pm10") else "pm25"] = v
                bucket.append(v)
            except (ValueError, TypeError):
                pass
        if entry:
            by_station[it["stationName"]] = entry

    avg = {
        "pm10": round(sum(pm10s) / len(pm10s)) if pm10s else None,
        "pm25": round(sum(pm25s) / len(pm25s)) if pm25s else None,
    }
    return {"stations": by_station, "avg": avg}


def dust_for(sigungu: str, dust: dict) -> tuple:
    """시군구명과 일치하는 측정소 값, 없으면 시/도 평균 (값, 평균여부)"""
    st = dust["stations"].get(sigungu)
    if st and ("pm10" in st or "pm25" in st):
        return {"pm10": st.get("pm10"), "pm25": st.get("pm25")}, False
    return dust["avg"], True
```

- [ ] **Step 4: build_message 시그니처 변경**

`briefing.py:135-166` `build_message`의 제목과 평균 표기를 시군구/시도 기준으로:
```python
def build_message(now: datetime, sido: str, sigungu: str, w: dict,
                  d: dict, is_avg: bool) -> str:
    lines = [f"🌅 <b>{now.strftime('%-m월 %-d일')} {sigungu} 아침 브리핑</b>", ""]

    if w:
        lines.append(summarize_rain(w["rain_hours"], w["pop_max"]))
        temp = []
        if w["tmn"] is not None:
            temp.append(f"최저 {w['tmn']:.0f}°C")
        if w["tmx"] is not None:
            temp.append(f"최고 {w['tmx']:.0f}°C")
        if temp:
            lines.append("🌡 " + " / ".join(temp))
        if w["sky"]:
            lines.append(f"하늘: {w['sky']}")
    else:
        lines.append("⚠️ 날씨 정보를 불러오지 못했어요.")

    lines.append("")
    if d and (d.get("pm10") is not None or d.get("pm25") is not None):
        suffix = f" ({sido} 평균)" if is_avg else ""
        if d.get("pm10") is not None:
            lines.append(f"미세먼지(PM10): {d['pm10']:.0f}㎍/㎥ · {grade_pm10(d['pm10'])}{suffix}")
        if d.get("pm25") is not None:
            lines.append(f"초미세먼지(PM2.5): {d['pm25']:.0f}㎍/㎥ · {grade_pm25(d['pm25'])}{suffix}")
        if (d.get("pm10") and d["pm10"] > 80) or (d.get("pm25") and d["pm25"] > 35):
            lines.append("😷 마스크 챙기시는 걸 추천해요!")
    else:
        lines.append("⚠️ 미세먼지 정보를 불러오지 못했어요.")

    lines.append("\n좋은 하루 보내세요! 💪")
    return "\n".join(lines)
```

- [ ] **Step 5: import 및 main() 수정**

`briefing.py:10`:
```python
from common import KST, REGIONS, SERVICE_KEY, load_state, send_message
```
`briefing.py:169-209` `main()` 교체:
```python
def main():
    now = datetime.now(KST)
    users = load_state()["users"]
    if not users:
        print("등록된 유저가 없어요. 종료.")
        return

    weather_cache: dict = {}   # (nx, ny) -> weather
    dust_cache: dict = {}      # airkorea sidoName -> dust
    sent = failed = 0

    for chat_id, info in users.items():
        sido, sigungu = info.get("sido"), info.get("sigungu")
        if sido not in REGIONS or sigungu not in REGIONS[sido]["sigungu"]:
            continue
        g = REGIONS[sido]["sigungu"][sigungu]
        grid = (g["nx"], g["ny"])
        if grid not in weather_cache:
            try:
                weather_cache[grid] = fetch_weather(now, *grid)
            except Exception as e:
                print(f"[weather {sigungu}] 실패: {e}", file=sys.stderr)
                weather_cache[grid] = None

        airkorea = REGIONS[sido]["airkorea"]
        if airkorea not in dust_cache:
            try:
                dust_cache[airkorea] = fetch_dust(airkorea)
            except Exception as e:
                print(f"[dust {airkorea}] 실패: {e}", file=sys.stderr)
                dust_cache[airkorea] = None
        dust = dust_cache[airkorea]
        d, is_avg = dust_for(sigungu, dust) if dust else (None, False)

        msg = build_message(now, sido, sigungu, weather_cache[grid], d, is_avg)
        try:
            send_message(chat_id, msg)
            sent += 1
        except Exception as e:
            print(f"[send {chat_id}] 실패: {e}", file=sys.stderr)
            failed += 1
        time.sleep(0.1)

    print(f"전송 {sent}건 완료, 실패 {failed}건")
```

- [ ] **Step 6: 테스트 + import 점검**

Run: `python -m pytest tests/ -v`
Expected: PASS (전체)
Run: `python -c "import os; os.environ['DATA_GO_KR_KEY']='t'; os.environ['TELEGRAM_BOT_TOKEN']='t'; import briefing; print('ok')"`
Expected: `ok`

- [ ] **Step 7: 커밋**

```bash
git add briefing.py tests/test_dust.py
git commit -m "feat: 시도별 미세먼지 캐싱 + 시군구 브리핑"
```

---

## Task 6: README + 워크플로 점검

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 문구 수정**

`README.md`에서 다음을 수정:
- 제목/소개: "서울 자치구" → "전국 시/군/구", 예시 메시지 지역명 유지 가능
- 유저 안내(21-34행): "내 지역(구) 선택" → "시/도 선택 후 세부 시/군/구 선택" 2단계로 설명
- 구조 표(98-106행): `common.py` 설명을 "전국 시군구 격자좌표 로드"로, `regions.json`·`tools/build_regions.py` 행 추가
- 확장 섹션(121행): 기존 "다른 지역 확장" 문구를 "regions.json은 tools/build_regions.py로 재생성" 안내로 교체

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: 전국 확장 README 갱신"
```

---

## Task 7: 수동 종단 테스트

코드 머지 전 실제 텔레그램/Actions로 확인.

- [ ] **Step 1: regions.json 푸시 후 등록 테스트**

```bash
git push
```
텔레그램 봇에 `/start` → 시/도 키보드 도착 확인 → 시/도 탭 → 시군구 키보드 + `⬅ 뒤로` 확인 → `⬅ 뒤로` 동작 확인 → 시군구 선택 → 확정 메시지 확인.
(또는 GitHub Actions → 「유저 등록 처리」 Run workflow로 즉시 폴링)

- [ ] **Step 2: 브리핑 테스트**

GitHub Actions → 「서울 아침 브리핑」 Run workflow.
Expected: 선택한 시군구 제목의 브리핑 도착. 광역시 구는 구 측정소 값, 도 시군구는 "(○○도 평균)" 표기 확인.

- [ ] **Step 3: state.json 스키마 확인**

`state.json`의 등록 유저가 `{"sido":..., "sigungu":..., "name":...}` 형식인지 확인.

---

## Self-Review 결과

- **Spec 커버리지**: regions.json(Task1), 상태 스키마(Task4·5), 2단계 키보드(Task3·4), 시도별 dust+fallback(Task5), 테스트(Task1·2·3·5), README(Task6) — 전부 태스크 존재.
- **Placeholder**: 모든 코드 단계에 실제 코드 포함. 데이터 CSV 확보(Task1 Step6)는 검증 기준(17시도, 좌표범위, 서울 앵커 일치)으로 합격 판정.
- **타입 일관성**: `fetch_dust`/`dust_for`/`build_message`/`resolve_region`/키보드 함수 시그니처가 인터페이스 계약과 Task 간 일치 확인.
- **알려진 한계**: 시군구 중심좌표 1점 → 격자 1개. 면적 매우 큰 시군구는 가장자리 오차 가능(허용). 도 단위 미세먼지는 평균(메시지에 명시).
