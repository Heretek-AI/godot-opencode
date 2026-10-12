@tool
extends EditorPlugin
## Godot OpenCode companion addon entry point.
## Owns the authenticated bridge connection lifecycle: _enter_tree builds
## the connection node and starts the loopback server; _exit_tree tears it
## down synchronously so no socket outlives the plugin.

const Connection := preload("res://addons/godot_opencode/connection.gd")

const DEFAULT_CAPABILITY_DIR := "~/.config/opencode/godot/capabilities"
const BRIDGE_PORT := 9500

var _connection: Node = null


func _enter_tree() -> void:
	_connection = Connection.new()
	_connection.name = "GodotOpenCodeConnection"
	add_child(_connection)
	var err := _connection.startup(_capability_record_path())
	if err != OK:
		push_warning("GodotOpenCode: bridge not listening (%s)" % error_string(err))


func _exit_tree() -> void:
	if _connection != null and is_instance_valid(_connection):
		_connection.shutdown()
		remove_child(_connection)
		_connection.queue_free()
	_connection = null


func _capability_record_path() -> String:
	var override := OS.get_environment("GODOT_CAPABILITY_DIR").strip_edges()
	var directory := override if not override.is_empty() else DEFAULT_CAPABILITY_DIR
	return directory.path_join("%d.json" % BRIDGE_PORT)
