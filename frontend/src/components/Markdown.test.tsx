import { render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders GFM without executing raw HTML or unsafe links', () => {
    const { container } = render(<Markdown>{'# Заголовок\n<script>alert(1)</script>\n[x](javascript:alert(1))\n- [x] done'}</Markdown>)
    expect(screen.getByRole('heading', { name: 'Заголовок' })).toBeInTheDocument()
    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(screen.getByText('x').closest('a')).not.toHaveAttribute('href', expect.stringContaining('javascript:'))
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})
