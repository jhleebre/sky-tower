// The ten floors of the tower and the layout rules per difficulty.
// Feature names (intro / mix / feats) are built by world/generator.js.

/**
 * Layout knobs. `hard` is the original tower; `easy` only changes things behind
 * D.easy so the hard tower stays identical.
 *   k: step lengths, gap2: long gap, hop/hopN: flat hops, wideP: chance of a two-wide step,
 *   fireMul: fireball period multiplier, moverW: moving-block speed multiplier
 */
export const LAYOUTS = {
  hard: { easy: false, k: [2, 2, 3], gap2: 3, hop: [2, 2, 3], hopN: 3, wideP: 0, fireMul: 1, moverW: 1 },
  easy: { easy: true, k: [1, 2, 2], gap2: 2, hop: [2], hopN: 2, wideP: .35, fireMul: 1.4, moverW: .75 },
};

export const STAGES = [
  { name: '잔디 언덕', sky: '#86d0ff', block: 'grass', floor: '#e2e6f6', n: 8, intro: [], mix: ['hop'], feats: ['step', 'step', 'wide', 'stair', 'bridge'] },
  { name: '바위 계곡', sky: '#8fc3ef', block: 'stone', floor: '#e6e2f0', n: 10, intro: [], mix: ['side', 'hop', 'zigzag'], feats: ['step', 'gap2', 'bridge', 'wide', 'stair'], hint: '옆으로 뛰어야 하는 곳도 있어요!' },
  { name: '움직이는 다리', sky: '#a3dcff', block: 'wood', floor: '#efe2cc', n: 9, intro: ['mover', 'mover'], mix: ['side'], feats: ['step', 'mover', 'bridge', 'wide', 'hop'], hint: '파란 블록이 움직여요. 가까이 올 때 뛰어요!' },
  { name: '얼음 성', sky: '#cfe9ff', block: 'snow', floor: '#dfeefa', n: 9, intro: ['icebridge', 'icestep'], mix: ['hop'], feats: ['step', 'icebridge', 'icestep', 'wide', 'mover', 'side'], hint: '얼음 위에서는 미끄러져요. 천천히!' },
  { name: '젤리 정원', sky: '#bff0cf', block: 'moss', floor: '#dff3e2', n: 9, intro: ['slime', 'slime'], mix: ['zigzag'], feats: ['step', 'slime', 'icestep', 'mover', 'hop'], hint: '초록 젤리를 밟으면 높이 튕겨요!' },
  { name: '용암 동굴', sky: '#ffa877', block: 'sand', floor: '#f3d6c8', n: 10, intro: ['lavabridge', 'lavaside'], mix: ['hop', 'side'], feats: ['step', 'lavabridge', 'lavaside', 'slime', 'icebridge'], hint: '주황 용암은 닿으면 아웃! 뛰어넘어요.' },
  { name: '가시 공장', sky: '#9aa3c8', block: 'metal', floor: '#d9dce6', n: 10, intro: ['spike', 'spike'], mix: ['zigzag'], feats: ['step', 'spike', 'lavabridge', 'mover', 'hop'], hint: '가시가 들어갔을 때 빨리 지나가요!' },
  { name: '불꽃 성벽', sky: '#ff8a6a', block: 'redbrick', floor: '#f2d0c4', n: 10, intro: ['fire', 'fire'], mix: ['hop', 'side'], feats: ['step', 'fire', 'spike', 'slime', 'lavaside'], hint: '불덩이가 지나간 직후에 건너요!' },
  { name: '폭풍 다리', sky: '#5a4fa0', block: 'dark', floor: '#cfcae6', n: 11, intro: [], mix: ['mover', 'icebridge', 'lavabridge', 'spike', 'fire', 'slime', 'zigzag', 'hop'], feats: ['step', 'gap2', 'wide', 'side'], hint: '지금까지 나온 블록이 모두 섞여 있어요!' },
  { name: '하늘 꼭대기', sky: '#241e5c', block: 'quartz', floor: '#ece7dd', n: 13, intro: [], mix: ['spike', 'fire', 'mover', 'lavaside', 'slime', 'fire', 'spike', 'lavabridge', 'side', 'hop'], feats: ['step', 'gap2', 'zigzag'], hint: '마지막 층! 침착하게!' },
];
