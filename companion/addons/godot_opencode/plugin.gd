@tool
extends EditorPlugin
## Godot OpenCode companion addon entry point.
## Owns the authenticated bridge lifecycle: _enter_tree builds the
## connection, dispatcher, undo manager and domain handlers, then starts
## the loopback server; _exit_tree tears everything down synchronously so
## no socket or handler outlives the plugin.

const Connection := preload("res://addons/godot_opencode/connection.gd")
const Dispatcher := preload("res://addons/godot_opencode/dispatcher.gd")
const UndoManager := preload("res://addons/godot_opencode/undo_manager.gd")
const NodeHandler := preload("res://addons/godot_opencode/handlers/node_handler.gd")
const SignalHandler := preload("res://addons/godot_opencode/handlers/signal_handler.gd")
const ResourceHandler := preload("res://addons/godot_opencode/handlers/resource_handler.gd")

const DEFAULT_CAPABILITY_DIR := "~/.config/opencode/godot/capabilities"
const BRIDGE_PORT := 9500

var _connection: Node = null
var _dispatcher: RefCounted = null


func _enter_tree() -> void:
	var undo_manager := UndoManager.new(get_undo_redo())
	_dispatcher = Dispatcher.new()
	var nodes := NodeHandler.new(undo_manager)
	var signals := SignalHandler.new(undo_manager)
	var resources := ResourceHandler.new(undo_manager)
	_register_node_commands(nodes)
	_register_signal_commands(signals)
	_register_resource_commands(resources)
	_connection = Connection.new()
	_connection.name = "GodotOpenCodeConnection"
	_connection.dispatcher = _dispatcher
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
	if _dispatcher != null:
		_dispatcher.clear_queue()
	_dispatcher = null


func _process(_delta: float) -> void:
	if _dispatcher != null and _connection != null and _connection.is_listening():
		for response in _dispatcher.tick():
			_connection.send_response(response)


func _register_node_commands(handler: RefCounted) -> void:
	_dispatcher.register("create_node", handler.create_node)
	_dispatcher.register("delete_node", handler.delete_node)
	_dispatcher.register("reparent_node", handler.reparent_node)
	_dispatcher.register("set_property", handler.set_property)
	_dispatcher.register("instantiate_scene", handler.instantiate_scene)


func _register_signal_commands(handler: RefCounted) -> void:
	_dispatcher.register("list_signals", handler.list_signals)
	_dispatcher.register("connect_signal", handler.connect_signal)
	_dispatcher.register("disconnect_signal", handler.disconnect_signal)


func _register_resource_commands(handler: RefCounted) -> void:
	_dispatcher.register("search_resources", handler.search_resources)
	_dispatcher.register("load_resource", handler.load_resource)
	_dispatcher.register("inspect_resource", handler.inspect_resource)
	_dispatcher.register("assign_resource", handler.assign_resource)


func _capability_record_path() -> String:
	var override := OS.get_environment("GODOT_CAPABILITY_DIR").strip_edges()
	var directory := override if not override.is_empty() else DEFAULT_CAPABILITY_DIR
	return directory.path_join("%d.json" % BRIDGE_PORT)
