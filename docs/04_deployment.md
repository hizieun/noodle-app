# 4. 배포 및 GitHub 연동

## Vercel 배포 방법

### 사전 준비
- [Vercel 계정](https://vercel.com) 필요 (GitHub 계정으로 간편 가입 가능)

### 최초 배포 (프로젝트 처음 올릴 때)

```bash
cd frontend
npx vercel
```

실행하면 다음 단계가 진행됩니다:
1. 브라우저가 열리며 `vercel.com/device` 페이지로 이동. 터미널에 표시된 코드를 입력해 로그인.
2. 자동으로 Vite 프로젝트 설정 감지 → "Set up and deploy?" → `Y` 입력
3. 배포 완료 후 Production URL 출력

### 이후 배포 (코드 수정 후 다시 배포)

```bash
cd frontend
npx vercel --prod
```

→ 기존 URL로 새 버전이 배포됩니다.

---

## 배포 URL

| 항목 | URL |
|------|-----|
| 라이브 서비스 | https://frontend-kappa-six-36.vercel.app |
| Vercel 대시보드 | https://vercel.com/raintear0705-5983s-projects/frontend |

---

## GitHub 저장소 연동

### 로컬 Git 저장소 초기화 (최초 1회)

```bash
cd /path/to/noodle    # 프로젝트 루트로 이동
git init
git add .
git commit -m "Initialize Noodle Web App"
```

### GitHub 원격 저장소 연결 및 Push

```bash
git remote add origin https://github.com/hizieun/noodle-app.git
git branch -M main
git push -u origin main
```

### 이후 코드 변경 사항 Push

```bash
git add .
git commit -m "feat: 변경 사항 설명"
git push
```

---

## `.gitignore` 설정 (중요)

불필요하거나 민감한 파일이 깃에 올라가지 않도록 `.gitignore`를 설정해 두었습니다.

```gitignore
# Python 가상환경 (용량이 크고 개인 환경 의존)
venv/
__pycache__/
*.pyc
.env          # API 키 등 민감 정보

# Node (의존성 모듈, 빌드 산출물)
node_modules/
dist/
.DS_Store

# 크롤링 결과물 (gitignore 처리, 필요시 수동 추가)
*.csv

# Vercel 세팅 폴더
.vercel
```

---

## GitHub 저장소 링크
- https://github.com/hizieun/noodle-app
