import { expect } from '@esm-bundle/chai';
import { sendKeys } from '@web/test-runner-commands';
import { Keymap } from "../src/keymap"

describe('keymap.type', () => {
    it('works with browser keyboard events', async () => {
        let count = 0;
        const km = new Keymap({
            'a': () => count++,
            'd d': () => count = 0,
            'ctrl+b': () => count += 2
        })

        const div = document.createElement('div')
        div.setAttribute('tabindex', '0')
        document.body.append(div);
        div.addEventListener('keydown', km.handleKeyboardEvent)


        div.focus();
        await sendKeys({press: 'a'})

        expect(count).to.eql(1)
        await sendKeys({press: 'b'})

        await sendKeys({press: 'Control+b'})
        expect(count).to.eql(3)

        await sendKeys({press: 'd'})
        await sendKeys({press: 'd'})

        expect(count).to.eql(0)
    })
})
