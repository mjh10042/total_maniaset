# total_maniaset

osu!mania 4K·7K용 tosu 오버레이 묶음입니다.
단 분석 엔진까지 오버레이 안에 들어 있어서 tosu만 켜 두면 됩니다. 따로 실행할 프로그램은 없습니다.

**[total_maniaset 다운로드 (zip)](https://github.com/mjh10042/total_maniaset/releases/latest/download/total_maniaset.zip)**

## 들어 있는 오버레이

| 오버레이 | 내용 |
| --- | --- |
| judgement | 판정선 |
| judgement+ | 판정선 + 정확도·점수 + 곡 진행 바 |
| fastslow | 노트마다 FAST / SLOW (또는 ms 수치) |
| hitcount | 판정 현황 (등급, 정확도, 비율, 개수, 빠름/느림) |
| dan | 지금 맵의 예상 단, 플레이 중 실력 단 (LIVE) |
| total_maniaset | 단위인정 코스는 곡별 정확도, 그 밖의 맵은 구간별 예상 단 |

## 설치

1. [zip을 받아](https://github.com/mjh10042/total_maniaset/releases/latest/download/total_maniaset.zip) 풀고, `total_maniaset` 폴더를 tosu의 `static` 폴더에 넣습니다. 예전 버전이 있으면 덮어씁니다. 그다음 tosu를 다시 시작합니다.
2. osu!에서 Ctrl+Shift+Space → 인게임 오버레이 매니저에서 빈 곳을 우클릭해 오버레이를 추가합니다.
3. 상자 크기는 내용에 맞춰져 있어서 배율과 위치만 맞추면 됩니다.
   - 추천 배율 (1080p): judgement·judgement+ 0.5, hitcount 0.7
   - dan은 이미 0.9 크기로 들어가고, total_maniaset은 1입니다.

- 설정은 tosu 대시보드 → total_maniaset → Settings 한 곳에 모두 있습니다.
- OBS에서는 브라우저 소스로 쓰면 됩니다 (예: `http://127.0.0.1:24050/total_maniaset/dan/`).
- 대시보드에서 total_maniaset 항목의 **Delete는 누르지 마세요.** 폴더째 지워집니다.

## 오버레이별 설명

### judgement / judgement+
- breadles의 Custom Hit Error Bar와 같은 모양과 설정입니다. 틱은 판정 오차, 화살표는 최근 오차의 가운데값입니다 (빠르면 파랑, 늦으면 빨강).
- DT처럼 판정 범위가 넓어져 상자보다 커지면 자동으로 줄여서 끝까지 보입니다.
- judgement+는 판정선 위에 내 정확도·점수 한 줄, 오른쪽에 곡 진행 바가 붙습니다. 둘 중 하나만 쓰세요.

### fastslow
- 노트를 칠 때마다 빠르면 FAST(빨강), 느리면 SLOW(파랑)가 나옵니다. 누르지 않은 Miss는 SLOW입니다.
- 기본으로 오차 16.5 ms 안쪽은 숨깁니다.
- 표시: FAST/SLOW만(기본) / 수치만 / 둘 다. 수치는 느리면 +, 빠르면 −이고, 소수점은 lazer에서만 나옵니다.

### hitcount
- 등급, 정확도(소수 0\~4자리), MA:PR · MA:GR · PR:GR 비율, MA\~MS 개수, UR을 보여 줍니다.
- PR\~MS 숫자 양옆에 빠름(빨강) / 느림(파랑) 개수가 나옵니다.
- 끝까지 친 플레이나 리플레이는 결과 화면을 나갈 때까지 남아 있습니다.
- 판정이 32,767개를 넘는 아주 긴 맵도 비교적 정확히 셉니다.
- 모양: Column(기본) / Box

### dan
- 고른 맵의 예상 단을 보여 줍니다. 단 기준은 Reform(기본) / Celestial / Signicial / Shoegazer 중에서 고릅니다.
  - LN 45%를 넘는 맵은 LN Course로 나옵니다: 1st\~10th → 夜明け Yoake … 夜風 Yokaze → 그 위는 17th, 18th…
  - 7K는 7K 단(0th\~Stellium)으로 나옵니다.
  - LN 30\~70% 하이브리드는 단노트 단과 롱노트 단을 함께 보여 줍니다.
- 그 밖에 계열(STREAM·JACK 등), DP와 강도 바, MSD(7K는 Sunny), SR · OD · BPM, pp, 곡 진행, 노트 밀도 그래프가 나옵니다.
- LIVE 실력 단 (4K, LN 45% 이하): 플레이 중 지금 정확도로 몇 단 수준인지 보여 줍니다. 이 맵을 96%로 치면 이 맵의 단이고, 100%는 Legend, 90% 미만은 Unqualified입니다.
- 4K 계산 엔진: 2.3.5+MMA 평균(기본) / 2.3.5 / MMA
- 모양: Minimal(기본) / Card

### total_maniaset 창
- 단위인정 코스 맵: 곡마다 정확도와 판정 개수가 나옵니다. 지금 치는 곡은 번호가 노랗게 표시됩니다.
- 그 밖의 맵: 맨 윗줄에 `아티스트 - 곡 제목 [난이도]`가 나오고, 4K·7K면 그 아래에 −3sec / now / +3sec 예상 단이 나옵니다 (0.1초마다 갱신).
  - 설정: 양옆 칸 간격(1\~10초), 지금만 보기, 칸 이름(English/한국어), 칸 지연(기본 −0.25초)
  - 색: 키아이 주황, 두드러진 구간 보라, 순간 난이도 분홍

<details>
<summary>인식되는 단위인정 코스</summary>

코스 맵은 .osu의 Title(제목)과 Creator(제작자)가 아래 표와 똑같아야 인식됩니다 (대소문자·띄어쓰기까지).
원본 업로드만 등록돼 있고, Title과 Creator를 그대로 두고 배속만 바꾼 맵은 인식됩니다.

| Title (제목) | Creator (제작자) | 비고 |
| --- | --- | --- |
| **4K** | | |
| Chordjack Joker Dan | [Crz]Rachel&Ice V, [Crz]Rachel&Jhown | Omega만 Jhown |
| Dan ~ REFORM ~ 1st Pack v2, Dan ~ REFORM ~ 2nd Pack | DDMythical | 다른 비트맵은 인정 X, 나머지는 구글에 검색하세요 |
| Dan ~ REFORM ~ FINAL | [GB]Thaumiel | Zeta, Eta 인정 |
| 4K LN Dan Courses v2 - Level 1 - (Level 2 / Level 3 / Extra Level / FINAL도 같은 형식) | _underjoy | ScoreV2를 켰을 때만 |
| 4K LN Dan Courses v3 - Extra Level - | hypersovae | ScoreV2를 켰을 때만 |
| TR1PLE DAN | wonder5193 | |
| 4K Luminal v2 | Pikapikapikapi | Original: Shoegazer |
| 4K Tachyon v3 | chicken Little | Original: Shoegazer |
| Malody 4K Regular Dans v3 (Part.1), (Part.2) | Muses | |
| Malody 4K Extra Dan v3 (Pack 1), (Pack 2) | [GS]hina | Ex-final 극후반 잘림 |
| Dan ~ REFORM ~ SAMPLE Pack 4 | Emik, Emik03 | EXTRA-EPSILON (Log-IN …), EXTRA-ZETA (Vertex Beta …) 두 채보만 |
| Haku dan | [Crz]Player | |
| **7K** | | |
| Regular Dan Phase I, II, III | Jinjin | |
| LN Dan Phase I, II, III | Jinjin | |
| Dan Phase IV | Jinjin | Stellium (Regular·LN) |

</details>

## 기타

- 4K·7K만 분석합니다. 다른 키 수는 Disabled로 나옵니다.
- 맵을 고르면 0.2\~0.8초 안에 분석됩니다. 처음 한 번은 엔진을 불러오느라 조금 더 걸립니다.
- 직접 보정한 건 Reform·LN·7K이고, Celestial·Signicial·Shoegazer는 DanOverlay 2.3.5 값 그대로입니다.
- 오버플로우 방지 포함 (100% 맞지는 않을 수 있음)
- 에타 및 롱 17부터는 자료가 부족해서 상대적으로 정확도가 떨어집니다.
- 단 측정 관련된 피드백을 주실 때는 조금 더 정확한 단 측정기가 있으면 추천 부탁드립니다.

> 이건 osu!mania 오버레이 및 더 좋은 경험을 위한 것이지, 단오버레이가 메인이 아닙니다.
> 조금 더 정확한 단 측정기가 있으면 저에게 말해주시면 감사하겠습니다.

## 출처 · 라이선스

total_maniaset은 MIT 라이선스입니다 (Copyright (c) 2026 kimlachal). 다른 프로젝트의 코드는 각자의 라이선스를 따릅니다. 전문과 각 고지는 [LICENSE](overlay/total_maniaset/LICENSE)에 있습니다.

| 출처 | 링크 | 라이선스 |
| --- | --- | --- |
| DanOverlay (8DOUL) | https://github.com/acarranzao1a-png/Dan-Overlay | MIT |
| ManiaMapAnalyser (Leo_Black) | https://github.com/LeoBlackMT/osumania_map_analyser | MIT |
| Etterna MinaCalc | https://github.com/etternagame/etterna | MIT |
| minacalc-rs (Glubus) | https://github.com/Glubus/minacalc-rs | MIT |
| minacalc-standalone (kangalio) | https://github.com/kangalio/minacalc-standalone | MIT |
| Sunny Rework (sunnyxxy) | https://github.com/sunnyxxy/Star-Rating-Rebirth | — |
| Daniel (TheBagelOfMan) | https://github.com/thebagelofman/Daniel | MIT |
| Companella (Leinadix) | https://github.com/leyna64/companella | MIT |
| YAVSRG Prelude (percyqaz) | https://github.com/YAVSRG/YAVSRG/tree/main/prelude | MIT |
| ONNX Runtime Web (Microsoft) | https://github.com/microsoft/onnxruntime | MIT |
| simfile-parser (Noah Manneschmidt) | https://github.com/noahm/simfile-parser | MIT |
| Odometer (HubSpot) | https://github.com/HubSpot/odometer | MIT |
| Google Sans Flex (글꼴) | https://github.com/googlefonts/googlesans-flex | SIL OFL 1.1 |
| Outfit (글꼴) | https://github.com/Outfitio/Outfit-Fonts | SIL OFL 1.1 |

모양만 참고 (코드·파일 미포함):

| 출처 | 링크 |
| --- | --- |
| Custom Hit Error Bar (breadles) — judgement | https://github.com/breadles5/customHitErrorBar |
| hitcount (2ky) — hitcount Box | https://x.com/s2skky |

4K LN Course 모델 보정 데이터 (osu! 비트맵):
[v2 Level 1](https://osu.ppy.sh/beatmapsets/891143) ·
[Level 2](https://osu.ppy.sh/beatmapsets/891152) ·
[Level 3](https://osu.ppy.sh/beatmapsets/891157) ·
[Extra Level](https://osu.ppy.sh/beatmapsets/891164) ·
[FINAL](https://osu.ppy.sh/beatmapsets/1116467) (_underjoy),
[v2 Stage 1](https://osu.ppy.sh/beatmapsets/2181524) ·
[Stage 2](https://osu.ppy.sh/beatmapsets/2181595) ·
[Stage 3](https://osu.ppy.sh/beatmapsets/2181627) ·
[Stage 4](https://osu.ppy.sh/beatmapsets/2181680) (AAAAFanboy, Stage 3: LongNote),
[v3 Extra Level](https://osu.ppy.sh/beatmapsets/2243057) (hypersovae)

`shared/engine/np.js` 끝의 Windows UCRT 수학 함수 재현부는 MIT 대상이 아닙니다 ([Universal C Runtime](https://learn.microsoft.com/en-us/cpp/windows/universal-crt-deployment)).
