"""Syntax-checks the generated package: YAML parses and every template compiles."""
import sys, yaml, jinja2
d = yaml.safe_load(open(sys.argv[1] if len(sys.argv) > 1 else 'lighting/ha/govuk_lighting.yaml'))
env = jinja2.Environment()
n = 0
def walk(x):
    global n
    if isinstance(x, dict): [walk(v) for v in x.values()]
    elif isinstance(x, list): [walk(v) for v in x]
    elif isinstance(x, str) and '{' in x: env.parse(x); n += 1
walk(d)
rooms = [k for k in d['script'] if k.startswith('govuk_lights_room_')]
assert all(d['script'][k]['mode'] == 'restart' for k in rooms), 'room wrappers must be mode: restart'
assert d['script']['govuk_lights_engine']['mode'] == 'parallel'
print(f'ok: {len(d["script"])} scripts, {len(rooms)} restart-mode room wrappers, {n} templates compile')
