# figma-script-bridge

Figma 데스크톱 플러그인 + 로컬 서버. 로컬에서 보낸 **Plugin API 스크립트**를 열린 Figma 파일 안에서 실행하고 결과(JSON·PNG)를 돌려받는다.
Figma 원격 MCP(`use_figma`)와 같은 규약이지만 사용자 앱 안에서 돌아서 MCP 호출 한도가 없고, 로컬 설치 서체를 쓴다.

## 설치 (한 번)
1. Figma 데스크톱 → Plugins → Development → **Import plugin from manifest…** → 이 폴더의 `manifest.json`
2. `node bridge.mjs serve` (127.0.0.1:3899)
3. 대상 파일에서 Plugins → Development → **Figma Script Bridge** 실행, 창을 켜 둔다("연결됨 · 대기 중")

## 사용
```sh
node bridge.mjs run script.js [outDir]
```
- `script.js`: top-level `await` + `return` (함수로 감싸지 않는다). `figma` 전역 사용.
- 반환값 안의 `Uint8Array`(예: `await node.exportAsync({ format: 'PNG' })`)는 `outDir/<키>.png`로 저장되고 JSON에는 `<png 키.png>`로 표시된다.
- 실패하면 `{ ok: false, error }`와 종료 코드 1.

## 보안
- 서버는 127.0.0.1에만 바인드한다.
- 잡 등록(`/job`)은 시작 시 생성한 토큰(`~/.figma-script-bridge-token`, 0600)이 있어야 한다.
- `/next`·`/result`는 플러그인 iframe(origin `null`)용이라 토큰이 없다. 로컬 개발 도구 한정으로 쓴다.
- 플러그인 네트워크 접근은 `devAllowedDomains: http://localhost:3899`만 허용한다.

## 테스트
```sh
node --test test.mjs
```
환경변수 `FIGMA_BRIDGE_PORT`, `FIGMA_BRIDGE_TOKEN_FILE`로 포트·토큰 파일을 바꿀 수 있다(테스트가 사용).
