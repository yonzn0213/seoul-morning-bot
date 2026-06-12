"""공용 모듈: 지역 정보, 상태 저장, 텔레그램 API 헬퍼"""

import json
import os
from datetime import timedelta, timezone
from pathlib import Path

import requests

KST = timezone(timedelta(hours=9))
STATE_FILE = Path(__file__).parent / "state.json"

SERVICE_KEY = os.environ["DATA_GO_KR_KEY"]
BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]

# 서울 25개 구: 기상청 단기예보 격자좌표 (nx, ny)
# 에어코리아 서울 측정소 이름은 구 이름과 동일
REGIONS = {
    "종로구": (60, 127), "중구": (60, 127), "용산구": (60, 126),
    "성동구": (61, 127), "광진구": (62, 126), "동대문구": (61, 127),
    "중랑구": (62, 128), "성북구": (61, 127), "강북구": (61, 128),
    "도봉구": (61, 129), "노원구": (61, 129), "은평구": (59, 127),
    "서대문구": (59, 127), "마포구": (59, 127), "양천구": (58, 126),
    "강서구": (58, 126), "구로구": (58, 125), "금천구": (59, 124),
    "영등포구": (58, 126), "동작구": (59, 125), "관악구": (59, 125),
    "서초구": (61, 125), "강남구": (61, 126), "송파구": (62, 126),
    "강동구": (62, 126),
}


# ---------- 상태(유저 목록 + 텔레그램 offset) ----------

def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"offset": 0, "users": {}}


def save_state(state: dict):
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


# ---------- 텔레그램 ----------

def tg(method: str, payload: dict) -> dict:
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    r = requests.post(url, json=payload, timeout=30)
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"telegram {method} 실패: {data}")
    return data


def send_message(chat_id, text: str, **kwargs):
    return tg("sendMessage", {"chat_id": chat_id, "text": text,
                              "parse_mode": "HTML", **kwargs})


def region_keyboard() -> dict:
    """25개 구를 3열 인라인 키보드로"""
    names = list(REGIONS)
    rows = [
        [{"text": n, "callback_data": f"r:{n}"} for n in names[i:i + 3]]
        for i in range(0, len(names), 3)
    ]
    return {"inline_keyboard": rows}
