// Korean visual explanations based on NASA Hubble birthday photo titles.
// The compact NASA archive lacks full image captions; these describe visible subject types.
function summarizeHubblePhoto(photo) {
 const t=String(photo?.name||'').toLowerCase();
 const has=(...w)=>w.some(x=>t.includes(x));
 let title,description;
 if(has('ngc 6752')&&has('galaxy','bedin','behind')){
  title='베딘 1(Bedin 1) 왜소은하 · NGC 6752 구상성단';
  description='이 사진의 밝고 촘촘한 별들은 지구에서 약 1만 3천 광년 떨어진 구상성단 NGC 6752에 속해요. 허블이 이 별무리를 관측하던 중, 그 뒤편 약 3천만 광년 거리에 숨어 있던 작은 왜소은하 베딘 1(Bedin 1)을 우연히 발견했어요. 베딘 1은 지름이 약 3천 광년으로 우리 은하 지름의 약 30분의 1밖에 되지 않고, 밝기도 우리 은하보다 약 천 배 어둡다고 해요. 사진에서 밝은 점은 가까운 성단의 별이고, 그 사이에 희미하게 뭉쳐 보이는 부분이 멀리 떨어진 베딘 1이에요. 서로 전혀 다른 거리에 있는 천체가 같은 화면에 겹쳐진 놀라운 장면입니다.';
 }else if(has('galaxy behind','behind star cluster','background galaxy')){
  title='가까운 별들 너머에 숨은 은하';
  description='앞쪽에 보이는 밝은 별무리 사이로 멀리 떨어진 은하가 포착된 모습이에요. 같은 방향에서 겹쳐 보이더라도 별과 은하가 실제로 같은 거리에 있는 것은 아니에요. 먼 천체까지 볼 수 있는 허블의 관측 능력이 돋보여요.';
 }else if(has('planetary nebula')){
  title='별이 마지막에 내보낸 빛나는 가스';
  description='수명을 다해 가는 별이 바깥층의 가스를 우주로 내보내 만든 행성상성운이에요. 퍼진 가스는 중심에 남은 뜨거운 별빛을 받아 고리나 구름처럼 빛나요. 이름에 행성이 들어가지만 실제로는 별의 생애 마지막 단계예요.';
 }else if(has('supernova remnant','supernova','crab nebula')){
  title='거대한 별의 폭발이 남긴 흔적';
  description='별이 폭발한 뒤 주변 우주로 퍼져 나간 가스와 먼지를 담은 사진이에요. 물질이 뻗어나가면서 밝은 구름이나 실타래 같은 구조가 만들어질 수 있어요. 오래전에 일어난 폭발의 흔적을 지금도 볼 수 있다는 점이 신기해요.';
 }else if(has('colliding galax','interacting galax','merging galax','galaxy merger')){
  title='중력으로 모습을 바꾸는 은하들';
  description='서로 가까워진 은하들이 중력 때문에 영향을 주고받는 모습을 담고 있어요. 그 안의 별과 가스가 움직이면서 은하가 길게 늘어나거나 휘어진 형태로 나타날 수 있어요. 멀리 떨어져 있는 은하들도 서로 영향을 주며 변해요.';
 }else if(has('galaxy cluster','cluster of galaxies')){
  title='수많은 별을 품은 은하들의 무리';
  description='사진의 여러 빛무리는 각각 수많은 별로 이루어진 은하예요. 이렇게 많은 은하들이 거대한 무리를 이루는 공간을 은하단이라고 불러요. 작은 빛점처럼 보이는 하나의 은하 안에도 엄청나게 많은 별이 있다는 사실이 놀라워요.';
 }else if(has('globular cluster')){
  title='오래된 별들이 빽빽하게 모인 구상성단';
  description='수많은 별들이 중력으로 묶여 둥근 모양으로 모여 있는 구상성단이에요. 중심에 가까울수록 별들이 더 촘촘하게 빛나는 모습을 볼 수 있어요. 이 별무리에는 오랜 세월 동안 살아온 별들이 많이 모여 있어요.';
 }else if(has('star cluster','open cluster','stellar cluster','cluster of stars')){
  title='한곳에 모여 반짝이는 별들의 무리';
  description='사진 속 작은 빛점들은 저마다 하나의 별이에요. 여러 별이 한곳에 모여 있고, 별마다 밝기와 색이 달라 서로 다른 느낌을 줘요. 이런 별무리에서는 별이 태어난 뒤 함께 변화하는 모습을 연구할 수 있어요.';
 }else if(has('spiral galaxy','spiral arms','barred spiral')){
  title='별과 먼지가 감겨 있는 나선은하';
  description='밝은 중심부 둘레를 나선팔이 감싸고 있는 은하의 모습이에요. 나선팔에는 별과 가스, 먼지가 함께 모여 있어 밝은 별무리와 어두운 띠를 만들기도 해요. 우리가 사는 은하수도 이처럼 나선 구조를 지닌 은하예요.';
 }else if(has('elliptical galaxy')){
  title='부드러운 빛의 덩어리처럼 보이는 타원은하';
  description='수많은 별들이 둥글거나 길쭉한 형태로 모여 있는 은하예요. 나선은하처럼 뚜렷한 팔보다는 별빛이 매끈하게 퍼진 모습이 특징이에요. 하나의 흐린 빛처럼 보여도 그 안에는 수많은 별이 있어요.';
 }else if(has('nebula','star-forming','stellar nursery','pillars of creation')){
  title='가스와 먼지가 펼쳐진 우주의 구름';
  description='우주에 퍼진 가스와 먼지가 커다란 성운을 이룬 모습이에요. 밝은 부분은 주변 별의 에너지를 받아 빛나는 가스일 수 있고, 어두운 부분은 별빛을 가리는 먼지일 수 있어요. 이런 물질이 뭉치는 곳에서는 새로운 별이 만들어지기도 해요.';
 }else if(has('jupiter')){
  title='구름과 거대한 소용돌이가 흐르는 목성';
  description='목성을 감싸는 밝고 어두운 구름 띠를 볼 수 있는 장면이에요. 이 무늬는 고정된 지형이 아니라 행성 대기에서 움직이는 구름과 폭풍이에요. 거대한 목성의 대기가 얼마나 역동적인지 보여 줘요.';
 }else if(has('saturn')){
  title='얼음 입자의 고리로 둘러싸인 토성';
  description='토성의 둥근 몸체와 그 주변의 넓은 고리를 볼 수 있는 사진이에요. 고리는 단단한 한 장의 판이 아니라 수많은 얼음 알갱이와 작은 조각들로 이루어져 있어요. 관측 각도에 따라 고리가 넓거나 얇게 보여요.';
 }else if(has('mars')){
  title='붉은 행성 화성의 표면과 대기';
  description='화성의 붉은빛 표면과 밝고 어두운 지형을 살펴볼 수 있어요. 화성은 계절에 따라 극지방의 얼음이나 대기 상태가 달라지기도 해요. 멀리서 보이는 작은 행성도 이렇게 다양한 모습을 지니고 있어요.';
 }else if(has('uranus','neptune')){
  title='태양계 바깥쪽의 차가운 푸른 행성';
  description='태양에서 멀리 떨어진 거대 행성의 대기 모습을 담고 있어요. 대기에 포함된 메탄 때문에 푸른빛이 두드러지고, 관측에 따라 밝은 구름도 드러날 수 있어요. 아주 먼 행성에서도 날씨와 대기가 변화해요.';
 }else if(has('galaxy','galaxies','galactic')){
  title='수많은 별이 모여 이루어진 먼 은하';
  description='이 사진은 우리 은하 밖에 있는 거대한 별들의 모임을 담고 있어요. 하나의 빛 덩어리처럼 보여도 그 안에는 수많은 별과 가스, 먼지가 있어요. 밝은 중심부와 주변의 흐릿한 구조를 따라 은하의 형태를 살펴볼 수 있어요.';
 }else if(has('star','stellar','binary')){
  title='별들이 만들어 내는 우주의 풍경';
  description='멀리 있는 별과 그 주변 환경이 담긴 사진이에요. 별은 스스로 빛을 내는 천체이며 색과 밝기는 별의 온도나 상태에 따라 달라요. 하나하나의 별이 모이면 이렇게 풍성한 우주의 풍경을 만들어요.';
 }else{
  title='허블이 포착한 먼 우주의 모습';
  description='허블 우주망원경이 먼 우주에 있는 천체를 관측한 모습이에요. 사진 속 밝고 어두운 부분을 따라가면 빛나는 물질들이 펼쳐진 구조를 볼 수 있어요. 정확한 천체의 종류와 특징은 아래 NASA 원문을 함께 참고해 주세요.';
 }
 return {title,description};
}
