/**
 * 랜딩(/)을 페이지째 새로 연다. 화면 안 이동(router)으로 가면 Next 가 앞 화면들의 상태(누른 버튼 · 받아 둔 데이터)를
 * 기억해 두었다가 같은 탭에서 다시 로그인한 사람에게 그대로 보여 준다. 로그아웃 뒤에는 그런 것이 남지 않아야 한다
 */
export const reloadToLanding = () => window.location.replace("/");
