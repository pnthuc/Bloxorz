-- Apply the same section breaks to Markdown -> DOCX and DOCX -> XeLaTeX.
function Header(header)
  local title = pandoc.utils.stringify(header.content)
  if header.level == 1 and title:match('^[2-6]%.') then
    if FORMAT == 'docx' then
      return {pandoc.RawBlock('openxml',
        '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'), header}
    elseif FORMAT:match('latex') then
      return {pandoc.RawBlock('latex', '\\clearpage'), header}
    end
  end
end
