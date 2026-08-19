"""Citation count-align contract tests.

The core invariant: evidence blocks are numbered `[1]..[N]` and block `[N]`
always corresponds to `sources[N-1]`. A regression here (a fetch failing and
shifting the zip pairing) caused answer citations to point at the wrong source
or at a source index beyond the emitted list.
"""

from app.schemas.graph import SourceCitationSchema
from app.services.chat_agent import build_evidence_blocks


def _src(index: int) -> SourceCitationSchema:
    return SourceCitationSchema(
        id=f"src-{index}",
        title=f"Source {index}",
        url=f"https://example.com/{index}",
        snippet=f"snippet-{index}",
        publisher="Test",
        reliabilityScore=0.9,
    )


def test_evidence_index_matches_source_order():
    sources = [_src(1), _src(2), _src(3), _src(4)]
    fetched = {s.url: f"content-{i}" for i, s in enumerate(sources, start=1)}
    blocks = build_evidence_blocks(sources, fetched)

    assert len(blocks) == 4
    for idx, block in enumerate(blocks, start=1):
        assert block.startswith(f"[{idx}] SOURCE: Source {idx}")
        assert f"URL: https://example.com/{idx}" in block
        assert f"CONTENT:\ncontent-{idx}" in block


def test_failed_fetch_keeps_index_alignment():
    """A source whose page content fails to fetch must NOT shift later indices."""
    sources = [_src(1), _src(2), _src(3), _src(4)]
    fetched = {
        sources[0].url: "content-1",
        # sources[1] fetch fails
        sources[2].url: "content-3",
        sources[3].url: "content-4",
    }
    blocks = build_evidence_blocks(sources, fetched)

    assert len(blocks) == 4
    assert blocks[0].startswith("[1] SOURCE: Source 1") and "CONTENT:\ncontent-1" in blocks[0]
    # Source 2 keeps its [2] index, falling back to the snippet
    assert blocks[1].startswith("[2] SOURCE: Source 2")
    assert "CONTENT:" not in blocks[1]
    assert "SNIPPET:\nsnippet-2" in blocks[1]
    assert blocks[2].startswith("[3] SOURCE: Source 3") and "CONTENT:\ncontent-3" in blocks[2]
    assert blocks[3].startswith("[4] SOURCE: Source 4") and "CONTENT:\ncontent-4" in blocks[3]


def test_no_out_of_range_citation_indices():
    """Every emitted citation index [N] must exist in the sources list."""
    sources = [_src(1), _src(2)]
    fetched = {s.url: f"content-{i}" for i, s in enumerate(sources, start=1)}
    blocks = build_evidence_blocks(sources, fetched)

    assert len(blocks) == 2
    # The maximum index referenced must never exceed len(sources)
    max_idx = max(int(block.split("]")[0].lstrip("[")) for block in blocks)
    assert max_idx <= len(sources)


def test_empty_sources_yields_no_blocks():
    assert build_evidence_blocks([], {}) == []
