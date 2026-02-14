# Andersen Editor SPEC (MVP)

## 目的
- ハイブリッド構成図（オンプレ + クラウド）を、テンプレ(Role/EdgeKind)で編集し
- Mermaid(Flowchart)へ確実に反映し
- SVG/PNG/PDFへエクスポートできること

## 重要な設計方針
### 1) IR（内部モデル）を正本にする
GUI編集は IR -> Mermaid 生成で行う。

### 2) 双方向性は「AEモデル埋め込み」で成立させる
本アプリが生成する Mermaid には、コメント行として内部モデル(JSON)を base64url で埋め込む。

例:
%%AE:MODEL <base64url(JSON)>

- AE:MODEL が存在する Mermaid は、編集画面で IR を復元できる（Round-trip）。
- AE:MODEL が存在しない Mermaid は、プレビューのみ（テキスト編集モード）で扱う（Text-first）。

### 3) 箱・線の切替は「Role / EdgeKind」で表現する
- Node: role (server/app/vpn_gateway/db/lb/firewall...)
- Edge: kind (http/sql/tunnel/dependency/optional...)
Role/EdgeKind は templates/packs/*.json の辞書で定義し、見た目は templates/themes/*.json が決める。

## 対応範囲（MVP）
- Diagram: Flowchart
- Boundaries: subgraph（VPC/OnPrem/Subnet/DMZ など）
- Style: classDef/class, style(subgraph), linkStyle(edge)
- Export: SVG/PNG/PDF（PDFはChromium printToPDF）

