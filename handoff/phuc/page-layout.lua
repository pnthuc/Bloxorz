-- Keep pairs of 25-row result tables together in both Pandoc outputs.
-- The DOCX reader does not retain explicit page-break paragraphs, so apply
-- the same rule again when converting DOCX to XeLaTeX/PDF.
function Header(header)
  local title = pandoc.utils.stringify(header.content)
  if header.level == 1 and (title:match('^Bảng [246]%.') or title == 'Danh mục màn') then
    local pagebreak
    if FORMAT == 'docx' then
      pagebreak = pandoc.RawBlock('openxml',
        '<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
    elseif FORMAT:match('latex') then
      pagebreak = pandoc.RawBlock('latex', '\\clearpage')
    end
    if pagebreak then return {pagebreak, header} end
  end
end

function Table(tbl)
  if #tbl.colspecs == 4 then
    -- The level catalogue needs most of its width for the level name.
    tbl.colspecs = {
      {pandoc.AlignLeft, 0.08}, {pandoc.AlignLeft, 0.57},
      {pandoc.AlignRight, 0.20}, {pandoc.AlignRight, 0.15}
    }
  end
  return tbl
end
