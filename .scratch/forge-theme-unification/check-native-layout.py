#!/usr/bin/env python3
"""只读量测微信模拟器当前训练页，不创建草稿或修改成绩。

先在模拟器打开训练页，再运行此脚本；展开间歇时加 --rest。
"""
import argparse
import json
import subprocess
from pathlib import Path


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project', default=str(Path(__file__).resolve().parents[2]))
parser.add_argument('--rest', action='store_true', help='同时断言已展开的间歇面板布局')
args = parser.parse_args()
cli = '/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide'


def measure(selector):
    command = [cli, '-c', 'codex', 'automation_element_action', '--project', args.project,
               '--action', 'size', '--selector', selector]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=30, check=True)
    # CLI 可能在 JSON 前输出 skill-call 日志；只取响应对象。
    text = completed.stdout
    payload = json.loads(text[text.index('{'):])
    result = payload.get('result', {})
    if not payload.get('ok') or not result.get('success'):
        raise RuntimeError(f'{selector}: {payload}')
    print(f'{selector}: {result["width"]} × {result["height"]} px')
    return result['width']


row = measure('.set-pending')
inputs = measure('.set-pending .col-input')
check = measure('.set-pending .check-button')
delete = measure('.set-pending .delete-button')
menu = measure('.btn-more')
assert inputs >= 50, f'输入列被挤压: {inputs}px（原缺陷为 0px）'
assert 25 <= check <= 45, f'勾选按钮列异常: {check}px'
assert 15 <= delete <= 30, f'删除按钮列异常: {delete}px（原缺陷为 184px）'
assert 25 <= menu <= 45, f'动作菜单宽度异常: {menu}px'
assert 2 * inputs + check + delete <= row, '行内控件超出表格宽度'
if args.rest:
    panel = measure('.rest-sheet')
    end = measure('.end-rest')
    collapse = measure('.collapse-button')
    assert end >= panel * .8, f'结束休息按钮未占满内容区: {end}/{panel}px'
    assert 35 <= collapse <= 60, f'收起按钮挤压标题: {collapse}px'
print('PASS: 原生训练布局尺寸正常')