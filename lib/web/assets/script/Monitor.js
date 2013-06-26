var Monitor = {
	view: {
		dashboard: {
			display: function(data) {
				console.log(data);
			}
		},

		loading: {
			show: function() {

			},

			hide: function() {

			}
		}
	},

	model: {
		info: {
			get: function(callback) {
				//Phew, it's been a while since I've used a library
				//The simplicity here is refreshing.
				$.getJSON("/api", function(data) {
					console.log(data);
				});
			}
		}
	},

	controller: {
		dashboard: function() {
			Monitor.model.info.get(function(data) {
				Monitor.view.dashboard.display(data);
			});
		}
	},

	init: function() {
		//MVC style for future expansions
		Monitor.controller.dashboard();
	}
};

Monitor.init();