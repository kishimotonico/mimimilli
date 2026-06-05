// 受動スタック（背表紙）。末尾2階層より前の祖先カラムを左端に畳んだ見た目だけを示す。
// 正典 README 準拠でクリック非対応。階層移動はパンくず（アドレスバー）から。

export default function StackEdge() {
  return (
    <div className="mle-colstack" title="前の階層はスタック。移動はパンくずから">
      <div className="mle-colstack__edges">
        <span /><span /><span /><span />
      </div>
    </div>
  );
}
